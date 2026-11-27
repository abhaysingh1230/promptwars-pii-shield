import { describe, expect, it } from 'vitest'
import { SAMPLE_DATASETS } from '../../data/samples'
import { runSyntheticBenchmark } from '../benchmark'
import {
  detectOnDeviceAiStatus,
  generateOnDevicePrivacySummary,
} from '../chromeAi'
import { assessPrivacyRisk } from '../compliance'
import {
  PBKDF2_ITERATIONS,
  decryptVaultMappings,
  encryptVaultMappings,
  rehydratePseudonyms,
  validateVaultPassphrase,
} from '../cryptoVault'
import {
  escapeCsvFormula,
  parseCsvStrict,
  sanitizeCsvDocument,
} from '../csv'
import { sanitizeText, validateCustomRegex } from '../detector'
import { inspectClientNetworkEgress } from '../networkAudit'
import { DEFAULT_ENABLED_CATEGORIES, type SanitizeOptions } from '../types'
import {
  describePanType,
  detectCardBrand,
  isValidIpv4,
  isValidIpv6,
  luhnCheck,
  verhoeffCheck,
} from '../validators'

const fullOptions: SanitizeOptions = {
  mode: 'full',
  enabledCategories: { ...DEFAULT_ENABLED_CATEGORIES },
}

/**
 * Generates a Luhn check digit for a digit prefix so we can deterministically
 * test both valid and invalid Luhn numbers across every length 13..19.
 */
function makeValidLuhn(prefix: string): string {
  let sum = 0
  let shouldDouble = true
  for (let i = prefix.length - 1; i >= 0; i--) {
    let d = prefix.charCodeAt(i) - 48
    if (shouldDouble) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    shouldDouble = !shouldDouble
  }
  const check = (10 - (sum % 10)) % 10
  return `${prefix}${check}`
}

describe('Priority 1: RE2 linear-time custom regex safety', () => {
  it('executes catastrophic backtracking patterns in linear time without freezing', () => {
    // Evil backtracking patterns run in O(n) under Google's RE2 engine (re2js)
    const patterns = ['(a+)+$', '(a|aa)+$']
    const nearMatch = `${'a'.repeat(50_000)}!`

    for (const pattern of patterns) {
      expect(validateCustomRegex(pattern)).toBeNull()
      const t0 = performance.now()
      const res = sanitizeText(nearMatch, {
        ...fullOptions,
        customRules: [
          {
            id: 'evil',
            label: 'Catastrophic Pattern',
            pattern,
            tokenPrefix: 'EVIL',
            enabled: true,
          },
        ],
      })
      const elapsed = performance.now() - t0
      expect(res.countsByCategory.custom).toBe(0)
      expect(res.sanitizedText).toBe(nearMatch)
      expect(elapsed).toBeLessThan(250)
    }
  })

  it('rejects empty-matching, overlong, and nonlinear lookbehind syntax cleanly', () => {
    expect(validateCustomRegex('')).not.toBeNull()
    expect(validateCustomRegex('.*')).not.toBeNull()
    expect(validateCustomRegex('^$')).not.toBeNull()
    expect(validateCustomRegex('(?<=a)b')).not.toBeNull()
    expect(validateCustomRegex('a'.repeat(201))).not.toBeNull()
    expect(validateCustomRegex('\\bSBIN0001234\\b')).toBeNull()
  })

  it('detects safe custom RE2 rules and redacts exact spans', () => {
    const res = sanitizeText('IFSC SBIN0001234 verified', {
      ...fullOptions,
      mode: 'pseudonym',
      customRules: [
        {
          id: 'ifsc',
          label: 'Indian IFSC',
          pattern: '\\b[A-Z]{4}0[A-Z0-9]{6}\\b',
          tokenPrefix: 'IFSC',
          enabled: true,
        },
      ],
    })
    expect(res.entities).toHaveLength(1)
    expect(res.entities[0].category).toBe('custom')
    expect(res.sanitizedText).toBe('IFSC SECRET_01 verified')
  })
})

describe('Priority 2 & 5: CSV formula-injection & malformed CSV tests', () => {
  it('escapes formula triggers at start and after leading spaces or control chars', () => {
    const cases = [
      '=CMD("calc")',
      '+1+1',
      '-2+3',
      '@SUM(A1:A2)',
      '\t=1+1',
      '\r=1+1',
      '   =HYPERLINK("http://x")',
      ' \n +SUM(1,2)',
      '\u0001@IMPORTXML()',
    ]
    for (const c of cases) {
      expect(escapeCsvFormula(c)).toBe(`'${c}`)
    }
    expect(escapeCsvFormula('Normal text')).toBe('Normal text')
  })

  it('protects formula-like values in both quoted and unquoted CSV cells while preserving multiline quoting', () => {
    const csv = [
      'name,unquoted_formula,quoted_formula,multiline_formula,email',
      'Alice,=SUM(A1:A2),"  =CMD()","  +Line 1\nLine 2",alice@corp.in',
      'Bob,\t@SUM(B1)," -1+1","Safe, ""quoted"" text",alice@corp.in',
    ].join('\n')

    const res = sanitizeCsvDocument(csv, {
      ...fullOptions,
      mode: 'pseudonym',
      isCsv: true,
    })

    expect(res.csvParseError).toBeUndefined()
    expect(res.countsByCategory.email).toBe(2)
    expect(res.sanitizedText).toContain("'=SUM(A1:A2)")
    expect(res.sanitizedText).toContain("'  =CMD()")
    expect(res.sanitizedText).toContain('"\'  +Line 1\nLine 2"')
    expect(res.sanitizedText).toContain("'\t@SUM(B1)")
    expect(res.sanitizedText).toContain("' -1+1")
    expect(res.sanitizedText).toContain('"Safe, ""quoted"" text"')
    expect(res.sanitizedText.match(/EMAIL_01/g)).toHaveLength(2)
  })

  it('detects unterminated quotes and invalid post-quote syntax explicitly', () => {
    const unterminated = parseCsvStrict('name,email\n"Jane,jane@test.com')
    expect(unterminated.ok).toBe(false)
    expect(unterminated.error).toMatch(/unterminated/i)

    const badAfterQuote = parseCsvStrict('name,email\n"Jane"oops,jane@test.com')
    expect(badAfterQuote.ok).toBe(false)
    expect(badAfterQuote.error).toMatch(/closing quote/i)

    const midCellQuote = parseCsvStrict('name,email\nJa"ne,jane@test.com')
    expect(midCellQuote.ok).toBe(false)
    expect(midCellQuote.error).toMatch(/unescaped quote/i)

    const doc = sanitizeCsvDocument('a,b\n"broken', fullOptions)
    expect(doc.csvParseError).toMatch(/unterminated/i)
    expect(doc.sanitizedText).toBe('')
  })

  it('maintains repeated pseudonyms across CSV rows and multiline cells', () => {
    const csv = [
      'id,notes',
      '1,"Contact: user@corp.in\nBackup: user@corp.in"',
      '2,"Escalated by user@corp.in"',
    ].join('\n')

    const res = sanitizeCsvDocument(csv, {
      ...fullOptions,
      mode: 'pseudonym',
      isCsv: true,
    })

    expect(res.countsByCategory.email).toBe(3)
    expect(res.sanitizedText).toBe(
      'id,notes\n1,"Contact: EMAIL_01\nBackup: EMAIL_01"\n2,Escalated by EMAIL_01'
    )
  })
})

describe('Priority 3 & 5: IPv4 and standards-based IPv6 validation', () => {
  it('accepts full, compressed, loopback, and IPv4-mapped IPv6 and rejects unspecified/malformed/overlong/incomplete', () => {
    const valid = [
      '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
      '2001:db8::1',
      '::1',
      '::ffff:192.0.2.128',
      '64:ff9b::192.0.2.33',
      '0:0:0:0:0:ffff:192.1.56.10',
    ]
    for (const ip of valid) {
      expect(isValidIpv6(ip)).toBe(true)
      const res = sanitizeText(`Host ${ip} logged`, fullOptions)
      expect(res.entities).toHaveLength(1)
      expect(res.entities[0].category).toBe('ip_address')
      expect(res.sanitizedText).toBe('Host [REDACTED] logged')
    }

    const invalid = [
      '::',
      '0:0:0:0:0:0:0:0',
      '2001::db8::1',
      '2001:db8:zzzz::1',
      '2001:db8:12345::1',
      '2001:0db8:85a3:0000:0000:8a2e:0370:7334:9999',
      '2001:db8:85a3',
      '2001:db8:::',
      '::ffff:999.0.2.128',
    ]
    for (const bad of invalid) {
      expect(isValidIpv6(bad)).toBe(false)
      const text = `Bad ${bad} ignored`
      const res = sanitizeText(text, fullOptions)
      expect(res.countsByCategory.ip_address).toBe(0)
      expect(res.sanitizedText).toBe(text)
    }
  })

  it('validates IPv4 octets and skips version strings', () => {
    expect(isValidIpv4('192.168.1.1')).toBe(true)
    expect(isValidIpv4('999.168.1.1')).toBe(false)
    expect(isValidIpv4('192.016.1.1')).toBe(false)

    const res = sanitizeText(
      'IP 10.0.0.1 | Bad 999.1.1.1 | Ver v1.2.3.4',
      fullOptions
    )
    expect(res.countsByCategory.ip_address).toBe(1)
    expect(res.sanitizedText).toBe('IP [REDACTED] | Bad 999.1.1.1 | Ver v1.2.3.4')
  })
})

describe('Priority 4 & 5: Luhn 13-19, overlaps, PAN, Unicode, and phone numbering plans', () => {
  it('validates and rejects Luhn numbers across every length 13 through 19', () => {
    for (let len = 13; len <= 19; len++) {
      const prefix = `4${'123456789012345678'.slice(0, len - 2)}`
      const validCard = makeValidLuhn(prefix)
      expect(validCard).toHaveLength(len)
      expect(luhnCheck(validCard)).toBe(true)

      const lastDigit = Number(validCard[validCard.length - 1])
      const invalidCard = `${validCard.slice(0, -1)}${(lastDigit + 1) % 10}`
      expect(luhnCheck(invalidCard)).toBe(false)

      const res = sanitizeText(
        `OK:${validCard} NO:${invalidCard}`,
        fullOptions
      )
      expect(res.countsByCategory.credit_card).toBe(1)
      expect(res.luhnRejected).toHaveLength(1)
      expect(res.sanitizedText).toBe(`OK:[REDACTED] NO:${invalidCard}`)
    }
  })

  it('handles overlapping credit card, Aadhaar, and phone candidates deterministically', () => {
    const valid16 = makeValidLuhn('453201511283036')
    const res = sanitizeText(
      `Card ${valid16} | Aadhaar 4512 8890 1234 | Phone +91 98765 43210`,
      fullOptions
    )
    expect(res.countsByCategory.credit_card).toBe(1)
    expect(res.countsByCategory.aadhaar).toBe(1)
    expect(res.countsByCategory.phone).toBe(1)
    expect(res.sanitizedText).toBe(
      'Card [REDACTED] | Aadhaar [REDACTED] | Phone [REDACTED]'
    )
  })

  it('detects lowercase and mixed-case PAN while avoiding non-PAN words', () => {
    const res = sanitizeText(
      'Upper: ABCPK1234F | Lower: abcpk1234f | Mixed: AbcPk1234F | Word: error1234a',
      { ...fullOptions, mode: 'partial' }
    )
    expect(res.countsByCategory.pan).toBe(3)
    expect(res.sanitizedText).toBe(
      'Upper: AB*****34F | Lower: AB*****34F | Mixed: AB*****34F | Word: error1234a'
    )
  })

  it('detects PII cleanly with Unicode characters immediately before and after', () => {
    const res = sanitizeText(
      'ईमेलrohan@bharat.inहै | पैनABCPK1234Fको | फ़ोन+919876543210नंबर',
      fullOptions
    )
    expect(res.entities.map((e) => e.category)).toEqual([
      'email',
      'pan',
      'phone',
    ])
    expect(res.sanitizedText).toBe(
      'ईमेल[REDACTED]है | पैन[REDACTED]को | फ़ोन[REDACTED]नंबर'
    )
  })

  it('validates Indian and international phone formats with extensions and ignores ordinary numeric IDs', () => {
    const input = [
      'IN mob: +91 98765 43210',
      'IN plain: 9876543210',
      'IN STD: 011-23456789',
      'UK ext: +44 20 7946 0958 ext. 42',
      'US paren: (415) 555-0192',
      'AU: +61 412 345 678',
      'ID: 1234567890',
      'Batch: 2026112700',
      'Repeat: 9999999999',
    ].join(' | ')

    const res = sanitizeText(input, fullOptions)
    expect(res.countsByCategory.phone).toBe(6)
    expect(res.sanitizedText).toBe(
      'IN mob: [REDACTED] | IN plain: [REDACTED] | IN STD: [REDACTED] | UK ext: [REDACTED] | US paren: [REDACTED] | AU: [REDACTED] | ID: 1234567890 | Batch: 2026112700 | Repeat: 9999999999'
    )
  })
})

describe('Vault, validators metadata, network audit, and on-device AI helpers', () => {
  it('exposes card brand, PAN entity, Aadhaar Verhoeff status, and 600k PBKDF2 vault', async () => {
    expect(detectCardBrand('4111111111111111')).toBe('Visa')
    expect(detectCardBrand('378282246310005')).toBe('Amex')
    expect(describePanType('ABCPK1234F')).toBe('Individual')
    expect(verhoeffCheck('123456789012')).toBe(false)

    expect(PBKDF2_ITERATIONS).toBe(600_000)
    expect(validateVaultPassphrase('short')).not.toBeNull()
    expect(validateVaultPassphrase('StrongPass2026!')).toBeNull()

    const payload = await encryptVaultMappings(
      [{ pseudonym: 'EMAIL_01', originalValue: 'alice@corp.in' }],
      'StrongPass2026!'
    )
    expect(payload.iterations).toBe(600_000)
    expect(await decryptVaultMappings(payload, 'StrongPass2026!')).toEqual([
      { pseudonym: 'EMAIL_01', originalValue: 'alice@corp.in' },
    ])

    const restored = rehydratePseudonyms('Ticket EMAIL_01', [
      { pseudonym: 'EMAIL_01', originalValue: 'alice@corp.in' },
    ])
    expect(restored.restoredText).toBe('Ticket alice@corp.in')
  })

  it('assesses compliance estimate, network silence, and Chrome AI fallback cleanly', async () => {
    const res = sanitizeText(SAMPLE_DATASETS[0].content, fullOptions)
    const assessment = assessPrivacyRisk(res)
    expect(assessment.rawRiskScore).toBeGreaterThanOrEqual(75)

    const net = inspectClientNetworkEgress()
    expect(net.externalCalls).toBe(0)
    expect(net.verifiedZeroExternalTraffic).toBe(false)

    const benchmark = runSyntheticBenchmark()
    expect(benchmark.isSynthetic).toBe(true)
    expect(benchmark.totalCases).toBe(9)
    expect(benchmark.passedCases).toBe(9)
    expect(benchmark.failedCases).toBe(0)
    expect(benchmark.falsePositives).toBe(0)
    expect(benchmark.falseNegatives).toBe(0)

    expect(await detectOnDeviceAiStatus()).toBe('unavailable')
    const advice = await generateOnDevicePrivacySummary(
      res.countsByCategory,
      res.luhnRejected.length,
      'full'
    )
    expect(advice.source).toBe('local-engine')
  })
})
