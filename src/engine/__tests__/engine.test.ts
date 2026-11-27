import { describe, expect, it } from 'vitest'
import { SAMPLE_DATASETS } from '../../data/samples'
import { sanitizeCsvDocument, parseCsv, serializeCsv } from '../csv'
import { sanitizeText } from '../detector'
import { DEFAULT_ENABLED_CATEGORIES, type SanitizeOptions } from '../types'
import {
  describePanType,
  detectCardBrand,
  isValidIpv4,
  isValidIpv6,
  luhnCheck,
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
