import { describe, expect, it } from 'vitest'
import { SAMPLE_DATASETS } from '../../data/samples'
import {
  detectOnDeviceAiStatus,
  generateOnDevicePrivacySummary,
} from '../chromeAi'
import { assessPrivacyRisk } from '../compliance'
import {
  decryptVaultMappings,
  encryptVaultMappings,
  rehydratePseudonyms,
} from '../cryptoVault'
import { sanitizeCsvDocument, parseCsv, serializeCsv } from '../csv'
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

    // Verhoeff check rejects clearly invalid checksums while format matcher still catches test IDs
    expect(verhoeffCheck('123456789012')).toBe(false)
  })
})

describe('PII detection & 3 redaction modes', () => {
  const sampleInput = [
    'Email: alice@corp.in and Alice@corp.in',
    'Phone: +91 98765 43210 and 9876543210',
    'PAN: ABCPK1234F | Aadhaar: 4512 8890 1234',
    'IP: 192.168.10.25 | Version: v1.2.3.4',
    'Valid Card: 4111-1111-1111-1111 | Fake 16-digit: 1234-5678-9012-3456',
  ].join('\n')

  it('detects all 6 PII types and skips non-Luhn 16-digit numbers and version tags', () => {
    const res = sanitizeText(sampleInput, baseOptions)

    expect(res.countsByCategory.email).toBe(2)
    expect(res.countsByCategory.phone).toBe(2)
    expect(res.countsByCategory.pan).toBe(1)
    expect(res.countsByCategory.aadhaar).toBe(1)
    expect(res.countsByCategory.ip_address).toBe(1)
    expect(res.countsByCategory.credit_card).toBe(1)

    expect(res.luhnRejected).toHaveLength(1)
    expect(res.luhnRejected[0].raw).toBe('1234-5678-9012-3456')

    expect(res.sanitizedText).toContain('v1.2.3.4')
    expect(res.sanitizedText).toContain('1234-5678-9012-3456')
    expect(res.sanitizedText).not.toContain('4111-1111-1111-1111')
    expect(res.sanitizedText).toContain('[REDACTED]')
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

    // Both "alice@corp.in" and "Alice@corp.in" must map to EMAIL_01
    const emailMatches = res.sanitizedText.match(/EMAIL_01/g) ?? []
    expect(emailMatches).toHaveLength(2)
    expect(res.sanitizedText).not.toContain('EMAIL_02')

    // Both "+91 98765 43210" and "9876543210" must map to PHONE_01
    const phoneMatches = res.sanitizedText.match(/PHONE_01/g) ?? []
    expect(phoneMatches).toHaveLength(2)
    expect(res.sanitizedText).not.toContain('PHONE_02')
  })

  it('respects category toggles', () => {
    const res = sanitizeText(sampleInput, {
      mode: 'full',
      enabledCategories: {
        ...DEFAULT_ENABLED_CATEGORIES,
        email: false,
        ip_address: false,
      },
    })

    expect(res.countsByCategory.email).toBe(0)
    expect(res.countsByCategory.ip_address).toBe(0)
    expect(res.sanitizedText).toContain('alice@corp.in')
    expect(res.sanitizedText).toContain('192.168.10.25')
  })
})

describe('CSV sanitization and sample datasets', () => {
  it('parses and serializes RFC-4180 CSV with quoted commas cleanly', () => {
    const raw = 'name,note\n"Doe, Jane","Email: jane@test.com, IP: 10.0.0.1"'
    const rows = parseCsv(raw)
    expect(rows).toEqual([
      ['name', 'note'],
      ['Doe, Jane', 'Email: jane@test.com, IP: 10.0.0.1'],
    ])
    expect(serializeCsv(rows)).toBe(raw)
  })

  it('maintains pseudonym consistency across CSV rows and preserves columns', () => {
    const hrCsv = SAMPLE_DATASETS.find((s) => s.id === 'hr-csv')
    expect(hrCsv).toBeDefined()

    const res = sanitizeCsvDocument(hrCsv!.content, {
      mode: 'pseudonym',
      enabledCategories: { ...DEFAULT_ENABLED_CATEGORIES },
      isCsv: true,
    })

    expect(res.csvRowCount).toBe(5)
    expect(res.csvColCount).toBe(8)
    // Recurring Aarav email in EMP-101 and EMP-103 maps to EMAIL_01 twice
    expect(res.sanitizedText.match(/EMAIL_01/g)).toHaveLength(2)
    // Non-Luhn 1234567890123456 in EMP-103 is rejected by Luhn
    expect(res.luhnRejected.some((r) => r.digits === '1234567890123456')).toBe(
      true
    )
    expect(res.sanitizedText).toContain('1234567890123456')
  })

  it('runs cleanly across all 4 built-in sample datasets', () => {
    for (const sample of SAMPLE_DATASETS) {
      const res =
        sample.format === 'csv'
          ? sanitizeCsvDocument(sample.content, baseOptions)
          : sanitizeText(sample.content, baseOptions)

      expect(res.totalEntities).toBeGreaterThan(0)
      expect(res.luhnRejected.length).toBeGreaterThan(0)
    }
  })
})

describe('compliance scoring, custom rules, and crypto vault', () => {
  it('computes Luhn sum diagnostics and compliance exposure scores', () => {
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
    expect(assessment.severityLabel).toBe('Critical')
  })

  it('safely validates and applies custom regex rules', () => {
    expect(validateCustomRegex('')).not.toBeNull()
    expect(validateCustomRegex('.*')).not.toBeNull()
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

  it('re-hydrates pseudonyms and round-trips AES-GCM encrypted vault keys', async () => {
    const restored = rehydratePseudonyms(
      'Follow up with EMAIL_01 regarding CARD_01 and EMAIL_01.',
      [
        { pseudonym: 'EMAIL_01', originalValue: 'alice@corp.in' },
        { pseudonym: 'CARD_01', originalValue: '4111-1111-1111-1111' },
      ]
    )

    expect(restored.replacementsApplied).toBe(3)
    expect(restored.restoredText).toBe(
      'Follow up with alice@corp.in regarding 4111-1111-1111-1111 and alice@corp.in.'
    )

    const payload = await encryptVaultMappings(
      [{ pseudonym: 'EMAIL_01', originalValue: 'alice@corp.in' }],
      'strong-passphrase'
    )
    expect(payload.algorithm).toBe('AES-GCM-256')
    const decrypted = await decryptVaultMappings(payload, 'strong-passphrase')
    expect(decrypted).toEqual([
      { pseudonym: 'EMAIL_01', originalValue: 'alice@corp.in' },
    ])
  })

  it('handles empty text, unicode text, IPv6, and large 100 KB logs efficiently', () => {
    const empty = sanitizeText('', baseOptions)
    expect(empty.totalEntities).toBe(0)
    expect(empty.sanitizedText).toBe('')

    const unicode = sanitizeText(
      'नाम: रोहन | Email: rohan@bharat.in | IPv6: 2001:db8:85a3::8a2e:370:7334',
      { ...baseOptions, mode: 'partial' }
    )
    expect(unicode.countsByCategory.email).toBe(1)
    expect(unicode.countsByCategory.ip_address).toBe(1)
    expect(unicode.sanitizedText).toContain('r***@bharat.in')
    expect(unicode.sanitizedText).toContain('2001:db8:****:****')

    const largeInput = Array.from(
      { length: 250 },
      () => SAMPLE_DATASETS[0].content
    ).join('\n')
    expect(largeInput.length).toBeGreaterThan(100_000)
    const largeRes = sanitizeText(largeInput, baseOptions)
    expect(largeRes.totalEntities).toBeGreaterThan(1000)
    expect(largeRes.processingMs).toBeLessThan(500)
  })

  it('verifies zero external network egress and on-device AI advisory', async () => {
    const net = inspectClientNetworkEgress()
    expect(net.verifiedZeroDataEgress).toBe(true)
    expect(net.externalApiCalls).toBe(0)

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
    expect(fallback.summary).toContain('PCI-DSS / DPDP Act')

    const g = globalThis as unknown as { LanguageModel?: unknown }
    g.LanguageModel = {
      availability: async () => 'available',
      create: async () => ({
        prompt: async () => 'Local Gemini Nano: PCI-DSS scope mitigated.',
        destroy: () => {},
      }),
    }
    try {
      expect(await detectOnDeviceAiStatus()).toBe('available')
      const nano = await generateOnDevicePrivacySummary(
        {
          credit_card: 1,
          pan: 0,
          aadhaar: 0,
          email: 0,
          phone: 0,
          ip_address: 0,
          custom: 0,
        },
        0,
        'full'
      )
      expect(nano.source).toBe('gemini-nano')
      expect(nano.summary).toContain('Local Gemini Nano')
    } finally {
      delete g.LanguageModel
    }
  })
})
