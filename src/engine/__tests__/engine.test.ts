import { describe, expect, it } from 'vitest'
import { SAMPLE_DATASETS } from '../../data/samples'
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
  parseCsv,
  parseCsvStrict,
  sanitizeCsvDocument,
  serializeCsv,
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
  luhnDiagnostics,
  verhoeffCheck,
} from '../validators'

const baseOptions: SanitizeOptions = {
  mode: 'full',
  enabledCategories: { ...DEFAULT_ENABLED_CATEGORIES },
}

describe('validators', () => {
  it('validates real Luhn credit cards and rejects random 16-digit numbers', () => {
    expect(luhnCheck('4111111111111111')).toBe(true)
    expect(luhnCheck('4242-4242-4242-4242')).toBe(true)
    expect(luhnCheck('378282246310005')).toBe(true)
    expect(luhnCheck('5500000000000004')).toBe(true)

    expect(luhnCheck('1234567890123456')).toBe(false)
    expect(luhnCheck('9988776655443322')).toBe(false)
    expect(luhnCheck('4000000000000001')).toBe(false)
    expect(luhnCheck('0000000000000000')).toBe(false)
    expect(luhnCheck('12345')).toBe(false)
  })

  it('detects card brands and PAN entity types', () => {
    expect(detectCardBrand('4111111111111111')).toBe('Visa')
    expect(detectCardBrand('378282246310005')).toBe('Amex')
    expect(detectCardBrand('5105105105105100')).toBe('Mastercard')
    expect(describePanType('ABCDE1234F')).toBe('PAN Entity')
    expect(describePanType('ABCPK1234F')).toBe('Individual')
    expect(describePanType('AAACC1234C')).toBe('Company')
  })

  it('validates IPv4, IPv6, and Aadhaar Verhoeff checksums', () => {
    expect(isValidIpv4('192.168.1.1')).toBe(true)
    expect(isValidIpv4('255.255.255.0')).toBe(true)
    expect(isValidIpv4('999.168.1.1')).toBe(false)
    expect(isValidIpv4('192.016.1.1')).toBe(false)

    expect(isValidIpv6('2001:db8:85a3::8a2e:370:7334')).toBe(true)
    expect(isValidIpv6('2001:db8:::1')).toBe(false)
    expect(verhoeffCheck('123456789012')).toBe(false)
  })
})

describe('PII detection, edge cases, and 3 redaction modes', () => {
  const sampleInput = [
    'Email: alice@corp.in and Alice@corp.in',
    'Phone: +91 98765 43210 and 9876543210 and +44 20 7946 0958',
    'PAN: ABCPK1234F | Lowercase PAN: abcpk1234f | Non-PAN: error1234a',
    'Aadhaar: 4512 8890 1234',
    'IP: 192.168.10.25 | Version: v1.2.3.4',
    'Valid Card: 4111-1111-1111-1111 | Fake 16-digit: 1234-5678-9012-3456',
  ].join('\n')

  it('detects all 6 PII types, mixed-case PAN, international phones, and skips non-Luhn 16-digit numbers', () => {
    const res = sanitizeText(sampleInput, baseOptions)

    expect(res.countsByCategory.email).toBe(2)
    expect(res.countsByCategory.phone).toBe(3)
    expect(res.countsByCategory.pan).toBe(2)
    expect(res.countsByCategory.aadhaar).toBe(1)
    expect(res.countsByCategory.ip_address).toBe(1)
    expect(res.countsByCategory.credit_card).toBe(1)

    expect(res.luhnRejected).toHaveLength(1)
    expect(res.luhnRejected[0].raw).toBe('1234-5678-9012-3456')

    expect(res.sanitizedText).toContain('v1.2.3.4')
    expect(res.sanitizedText).toContain('error1234a')
    expect(res.sanitizedText).toContain('1234-5678-9012-3456')
    expect(res.sanitizedText).not.toContain('abcpk1234f')
    expect(res.sanitizedText).not.toContain('+44 20 7946 0958')
  })

  it('handles Unicode boundaries around PII cleanly', () => {
    const res = sanitizeText(
      'ईमेल:rohan@bharat.in | पैन:ABCPK1234F | फ़ोन:+919876543210 | IPv6:2001:db8:85a3::8a2e:370:7334',
      { ...baseOptions, mode: 'partial' }
    )
    expect(res.countsByCategory.email).toBe(1)
    expect(res.countsByCategory.pan).toBe(1)
    expect(res.countsByCategory.phone).toBe(1)
    expect(res.countsByCategory.ip_address).toBe(1)
    expect(res.sanitizedText).toContain('r***@bharat.in')
    expect(res.sanitizedText).toContain('2001:db8:****:****')
  })

  it('retains partial verification context in partial mask mode', () => {
    const res = sanitizeText(sampleInput, {
      ...baseOptions,
      mode: 'partial',
    })

    expect(res.sanitizedText).toContain('a***@corp.in')
    expect(res.sanitizedText).toContain('XXXX-XXXX-1234')
    expect(res.sanitizedText).toContain('XXXX-XXXX-XXXX-1111')
    expect(res.sanitizedText).toContain('192.168.***.***')
    expect(res.sanitizedText).toContain('AB*****34F')
  })

  it('maintains consistent pseudonym mappings for recurring entities', () => {
    const res = sanitizeText(sampleInput, {
      ...baseOptions,
      mode: 'pseudonym',
    })

    expect(res.sanitizedText.match(/EMAIL_01/g) ?? []).toHaveLength(2)
    expect(res.sanitizedText.match(/PHONE_01/g) ?? []).toHaveLength(2)
    expect(res.sanitizedText.match(/PAN_01/g) ?? []).toHaveLength(2)
  })
})

describe('CSV hardening, malformed quote detection, and formula injection defense', () => {
  it('parses RFC-4180 CSV and flags malformed quoting explicitly', () => {
    const raw = 'name,note\n"Doe, Jane","Email: jane@test.com, IP: 10.0.0.1"'
    const rows = parseCsv(raw)
    expect(rows).toEqual([
      ['name', 'note'],
      ['Doe, Jane', 'Email: jane@test.com, IP: 10.0.0.1'],
    ])
    expect(serializeCsv(rows)).toBe(raw)

    const unterminated = parseCsvStrict('name,email\n"Jane,jane@test.com')
    expect(unterminated.ok).toBe(false)
    expect(unterminated.error).toMatch(/unterminated/i)

    const badQuote = parseCsvStrict('name,email\n"Jane"oops,jane@test.com')
    expect(badQuote.ok).toBe(false)
    expect(badQuote.error).toMatch(/closing quote/i)

    const docErr = sanitizeCsvDocument('a,b\n"unclosed', baseOptions)
    expect(docErr.csvParseError).toMatch(/unterminated/i)
  })

  it('escapes spreadsheet formula-leading cells in sanitized CSV exports', () => {
    expect(escapeCsvFormula('=CMD("calc")')).toBe("'=CMD(\"calc\")")
    expect(escapeCsvFormula('+1+1')).toBe("'+1+1")
    expect(escapeCsvFormula('-2+3')).toBe("'-2+3")
    expect(escapeCsvFormula('@SUM(A1:A2)')).toBe("'@SUM(A1:A2)")

    const csv =
      'name,formula,email\nAlice,"=HYPERLINK(""http://evil.test"")",alice@corp.in\nBob,=SUM(A1:A2),bob@corp.in'
    const res = sanitizeCsvDocument(csv, baseOptions)
    expect(res.csvParseError).toBeUndefined()
    expect(res.sanitizedText).toContain("'=HYPERLINK(")
    expect(res.sanitizedText).toContain("'=SUM(A1:A2)")
    expect(res.sanitizedText).toContain('[REDACTED]')
  })

  it('maintains pseudonym consistency across CSV rows including multiline cells', () => {
    const hrCsv = SAMPLE_DATASETS.find((s) => s.id === 'hr-csv')
    expect(hrCsv).toBeDefined()

    const res = sanitizeCsvDocument(hrCsv!.content, {
      mode: 'pseudonym',
      enabledCategories: { ...DEFAULT_ENABLED_CATEGORIES },
      isCsv: true,
    })

    expect(res.csvParseError).toBeUndefined()
    expect(res.csvRowCount).toBe(5)
    expect(res.csvColCount).toBe(8)
    expect(res.sanitizedText.match(/EMAIL_01/g)).toHaveLength(2)
    expect(res.luhnRejected.some((r) => r.digits === '1234567890123456')).toBe(
      true
    )
  })
})

describe('compliance scoring, ReDoS prevention, and strengthened 600k PBKDF2 vault', () => {
  it('computes Luhn diagnostics and compliance exposure estimate', () => {
    const valid = luhnDiagnostics('4111111111111111')
    expect(valid.valid).toBe(true)
    expect(valid.remainder).toBe(0)

    const fake = luhnDiagnostics('1234567890123456')
    expect(fake.valid).toBe(false)
    expect(fake.remainder).toBeGreaterThan(0)

    const res = sanitizeText(SAMPLE_DATASETS[0].content, baseOptions)
    const assessment = assessPrivacyRisk(res)
    expect(assessment.rawRiskScore).toBeGreaterThanOrEqual(75)
    expect(assessment.sanitizedRiskScore).toBe(0)
  })

  it('rejects catastrophic ReDoS custom patterns and applies safe custom rules', () => {
    expect(validateCustomRegex('')).not.toBeNull()
    expect(validateCustomRegex('.*')).not.toBeNull()
    expect(validateCustomRegex('(a+)+')).toMatch(/ReDoS/i)
    expect(validateCustomRegex('(a|aa)+')).toMatch(/ReDoS/i)
    expect(validateCustomRegex('[unclosed')).not.toBeNull()
    expect(validateCustomRegex('\\bSBIN0001234\\b')).toBeNull()

    const res = sanitizeText('Transfer to IFSC SBIN0001234 ASAP', {
      ...baseOptions,
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

    expect(res.countsByCategory.custom).toBe(1)
    expect(res.sanitizedText).toContain('SECRET_01')
  })

  it('enforces strong passphrase and 600k PBKDF2 + AES-GCM-256 round-trip', async () => {
    expect(PBKDF2_ITERATIONS).toBe(600_000)
    expect(validateVaultPassphrase('short')).not.toBeNull()
    expect(validateVaultPassphrase('onlylowercasechars')).not.toBeNull()
    expect(validateVaultPassphrase('StrongPass2026!')).toBeNull()

    const restored = rehydratePseudonyms(
      'Follow up with EMAIL_01 regarding CARD_01 and EMAIL_01.',
      [
        { pseudonym: 'EMAIL_01', originalValue: 'alice@corp.in' },
        { pseudonym: 'CARD_01', originalValue: '4111-1111-1111-1111' },
      ]
    )
    expect(restored.replacementsApplied).toBe(3)

    const payload = await encryptVaultMappings(
      [{ pseudonym: 'EMAIL_01', originalValue: 'alice@corp.in' }],
      'StrongPass2026!'
    )
    expect(payload.iterations).toBe(600_000)
    const decrypted = await decryptVaultMappings(payload, 'StrongPass2026!')
    expect(decrypted).toEqual([
      { pseudonym: 'EMAIL_01', originalValue: 'alice@corp.in' },
    ])
  })

  it('runs 100 KB throughput cleanly and verifies zero external network calls', async () => {
    const largeInput = Array.from(
      { length: 250 },
      () => SAMPLE_DATASETS[0].content
    ).join('\n')
    expect(largeInput.length).toBeGreaterThan(100_000)
    const largeRes = sanitizeText(largeInput, baseOptions)
    expect(largeRes.totalEntities).toBeGreaterThan(1000)
    expect(largeRes.processingMs).toBeLessThan(500)

    const net = inspectClientNetworkEgress()
    expect(net.verifiedZeroExternalTraffic).toBe(true)
    expect(net.externalCalls).toBe(0)

    expect(await detectOnDeviceAiStatus()).toBe('unavailable')
    const fallback = await generateOnDevicePrivacySummary(
      {
        credit_card: 1,
        pan: 1,
        aadhaar: 0,
        email: 2,
        phone: 0,
        ip_address: 0,
        custom: 0,
      },
      1,
      'partial'
    )
    expect(fallback.source).toBe('local-engine')
  })
})
