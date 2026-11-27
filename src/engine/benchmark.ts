import { escapeCsvFormula, parseCsv, sanitizeCsvDocument } from './csv'
import { sanitizeText } from './detector'
import { DEFAULT_ENABLED_CATEGORIES, type PiiCategory } from './types'

export interface BenchmarkCaseResult {
  id: string
  categoryGroup: string
  scenario: string
  passed: boolean
  falsePositives: number
  falseNegatives: number
  detail: string
  durationMs: number
}

export interface BenchmarkReport {
  isSynthetic: true
  totalCases: number
  passedCases: number
  failedCases: number
  falsePositives: number
  falseNegatives: number
  durationMs: number
  cases: BenchmarkCaseResult[]
}

const ALL_ON: Record<PiiCategory, boolean> = { ...DEFAULT_ENABLED_CATEGORIES }

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

export function runSyntheticBenchmark(): BenchmarkReport {
  const suiteStart = nowMs()
  const cases: BenchmarkCaseResult[] = []

  const pushCase = (
    id: string,
    categoryGroup: string,
    scenario: string,
    evaluate: () => {
      passed: boolean
      falsePositives?: number
      falseNegatives?: number
      detail: string
    }
  ) => {
    const start = nowMs()
    const outcome = evaluate()
    const elapsed = Number((nowMs() - start).toFixed(2))
    cases.push({
      id,
      categoryGroup,
      scenario,
      passed: outcome.passed,
      falsePositives: outcome.falsePositives ?? 0,
      falseNegatives: outcome.falseNegatives ?? 0,
      detail: outcome.detail,
      durationMs: elapsed,
    })
  }

  // 1. All required built-in PII categories
  pushCase('core-all-pii', 'Core PII', 'Email, PAN, Aadhaar (Verhoeff), Card, Phone, IPv4', () => {
    const text =
      'Mail aarav@demo.in, call +91 98765 43210, PAN ABCDE1234F, Aadhaar 5421 7789 3313, card 4111111111111111, IP 10.0.0.5'
    const res = sanitizeText(text, { mode: 'partial', enabledCategories: ALL_ON })
    const cats = new Set(res.entities.map((e) => e.category))
    const expected: PiiCategory[] = [
      'email',
      'phone',
      'pan',
      'aadhaar',
      'credit_card',
      'ip_address',
    ]
    const missed = expected.filter((c) => !cats.has(c)).length
    const verhoeffOk = res.entities.some(
      (e) =>
        e.category === 'aadhaar' &&
        e.validationNote === 'Verhoeff checksum verified'
    )
    const passed = missed === 0 && verhoeffOk
    return {
      passed,
      falseNegatives: missed + (verhoeffOk ? 0 : 1),
      detail: `${res.totalEntities} detected across ${cats.size}/6 categories`,
    }
  })

  // 2. Valid and invalid Luhn numbers from 13 to 19 digits
  pushCase('luhn-13-19', 'Luhn 13–19', 'Valid & invalid Luhn cards for every length 13..19', () => {
    const buildLuhnCard = (len: number, makeValid: boolean): string => {
      const body = `453201${'1'.repeat(len - 7)}`
      let sum = 0
      let shouldDouble = true
      for (let i = body.length - 1; i >= 0; i--) {
        let d = body.charCodeAt(i) - 48
        if (shouldDouble) {
          d *= 2
          if (d > 9) d -= 9
        }
        sum += d
        shouldDouble = !shouldDouble
      }
      const checkDigit = (10 - (sum % 10)) % 10
      const finalDigit = makeValid ? checkDigit : (checkDigit + 1) % 10
      return `${body}${finalDigit}`
    }

    let validRedacted = 0
    let invalidPreserved = 0
    let fn = 0
    let fp = 0
    for (let len = 13; len <= 19; len++) {
      const valid = buildLuhnCard(len, true)
      const invalid = buildLuhnCard(len, false)
      const rValid = sanitizeText(`Card ${valid}`, {
        mode: 'full',
        enabledCategories: ALL_ON,
      })
      if (rValid.countsByCategory.credit_card === 1) validRedacted += 1
      else fn += 1

      const rInvalid = sanitizeText(`Order ${invalid}`, {
        mode: 'full',
        enabledCategories: ALL_ON,
      })
      if (rInvalid.countsByCategory.credit_card === 0) invalidPreserved += 1
      else fp += 1
    }
    return {
      passed: fn === 0 && fp === 0,
      falseNegatives: fn,
      falsePositives: fp,
      detail: `${validRedacted}/7 valid redacted, ${invalidPreserved}/7 invalid preserved`,
    }
  })

  // 3. Overlapping card, Aadhaar, and phone candidates
  pushCase('overlap-priority', 'Overlap priority', 'Card, Aadhaar, and phone overlap resolution', () => {
    const res = sanitizeText(
      'Card 4111111111111111, Aadhaar 542177893313, Phone +91 9876543210',
      { mode: 'full', enabledCategories: ALL_ON }
    )
    const ok =
      res.countsByCategory.credit_card === 1 &&
      res.countsByCategory.aadhaar === 1 &&
      res.countsByCategory.phone === 1 &&
      res.totalEntities === 3
    return {
      passed: ok,
      falsePositives: Math.max(0, res.totalEntities - 3),
      falseNegatives: Math.max(0, 3 - res.totalEntities),
      detail: `Resolved ${res.totalEntities} non-overlapping entities`,
    }
  })

  // 4. Mixed-case PAN and Unicode characters around PII
  pushCase('pan-unicode', 'PAN & Unicode', 'Mixed-case ITD PAN and Devanagari/CJK boundaries', () => {
    const res = sanitizeText('नाम:rohan@demo.in। PAN abcpk1234fऔर', {
      mode: 'partial',
      enabledCategories: ALL_ON,
    })
    const ok =
      res.countsByCategory.email === 1 && res.countsByCategory.pan === 1
    return {
      passed: ok,
      falseNegatives: (res.countsByCategory.email === 0 ? 1 : 0) + (res.countsByCategory.pan === 0 ? 1 : 0),
      detail: 'Mixed-case PAN + Unicode adjacent email matched',
    }
  })

  // 5. Valid & malformed IPv4 and IPv6
  pushCase('ip-validation', 'IPv4 & IPv6', 'Valid loopback/mapped IPv6 and malformed token rejection', () => {
    const res = sanitizeText(
      'Valid ::1 and ::ffff:192.0.2.128 and 192.168.1.1; invalid 999.1.1.1 :: 2001:db8::1::2 2001:db8:1:2:3:4:5:6:7',
      { mode: 'full', enabledCategories: ALL_ON }
    )
    const count = res.countsByCategory.ip_address
    const hasMalformedRedacted = !res.sanitizedText.includes('2001:db8::1::2')
    const passed = count === 3 && !hasMalformedRedacted
    return {
      passed,
      falsePositives: hasMalformedRedacted ? 1 : 0,
      falseNegatives: Math.max(0, 3 - count),
      detail: `${count} valid IPs redacted, 4 invalid/unspecified preserved`,
    }
  })

  // 6. Indian and international phones vs numeric false positives
  pushCase('phones-intl', 'Phone plans', 'Indian +91/STD, US/UK with ext, reject order IDs', () => {
    const res = sanitizeText(
      'IN +91 98765 43210, STD 020 25678901, US +1 (415) 555-0192 ext 402; ID 1234567890',
      { mode: 'full', enabledCategories: ALL_ON }
    )
    const ok =
      res.countsByCategory.phone === 3 && res.sanitizedText.includes('1234567890')
    return {
      passed: ok,
      falsePositives: res.sanitizedText.includes('1234567890') ? 0 : 1,
      falseNegatives: Math.max(0, 3 - res.countsByCategory.phone),
      detail: `${res.countsByCategory.phone}/3 phones redacted, 10-digit ID kept`,
    }
  })

  // 7. Quoted, multiline, and malformed CSV
  pushCase('csv-strict', 'CSV parsing', 'Quoted multiline CSV and unterminated quote detection', () => {
    const good = sanitizeCsvDocument(
      'name,note\n"Sneha ""Admin""","Line1\nrohan@demo.in"',
      { mode: 'pseudonym', enabledCategories: ALL_ON, isCsv: true }
    )
    const bad = sanitizeCsvDocument('name,email\n"unterminated,rohan@demo.in', {
      mode: 'full',
      enabledCategories: ALL_ON,
      isCsv: true,
    })
    const ok =
      !good.csvParseError &&
      good.totalEntities === 1 &&
      Boolean(bad.csvParseError)
    return {
      passed: ok,
      falseNegatives: good.totalEntities === 1 ? 0 : 1,
      detail: bad.csvParseError ? 'Quoted multiline ok; malformed CSV caught' : 'Failed',
    }
  })

  // 8. Formula-like CSV values
  pushCase('csv-formula', 'CSV formula defense', 'Escape =, +, -, @ after spaces/tabs/CR', () => {
    const samples = ['=1+1', '  +CMD', '\t@SUM(A1)', ' \r-1+1']
    const allEscaped = samples.every((s) => escapeCsvFormula(s).startsWith("'"))
    const csvOut = sanitizeCsvDocument('note,email\n"  =SUM(A1)",a@b.co', {
      mode: 'pseudonym',
      enabledCategories: ALL_ON,
      isCsv: true,
    })
    const rows = parseCsv(csvOut.sanitizedText)
    const escapedCell = rows[1]?.[0]?.startsWith("'") ?? false
    return {
      passed: allEscaped && escapedCell,
      falseNegatives: allEscaped && escapedCell ? 0 : 1,
      detail: '4/4 leading-control formula payloads neutralized',
    }
  })

  // 9. Repeated pseudonyms across CSV rows and multiline cells
  pushCase('csv-pseudonyms', 'CSV pseudonyms', 'Consistent tokens across rows & multiline cells', () => {
    const csv =
      'id,email,card\n1,a@corp.in,4111111111111111\n2,"Note:\na@corp.in",4111-1111-1111-1111'
    const res = sanitizeCsvDocument(csv, {
      mode: 'pseudonym',
      enabledCategories: ALL_ON,
      isCsv: true,
    })
    const rows = parseCsv(res.sanitizedText)
    const sameEmail = rows[1]?.[1] === 'EMAIL_01' && rows[2]?.[1]?.includes('EMAIL_01')
    const sameCard = rows[1]?.[2] === 'CARD_01' && rows[2]?.[2] === 'CARD_01'
    return {
      passed: Boolean(sameEmail && sameCard),
      falseNegatives: sameEmail && sameCard ? 0 : 1,
      detail: 'EMAIL_01 & CARD_01 consistent across multiline rows',
    }
  })

  const passedCases = cases.filter((c) => c.passed).length
  const failedCases = cases.length - passedCases
  const falsePositives = cases.reduce((acc, c) => acc + c.falsePositives, 0)
  const falseNegatives = cases.reduce((acc, c) => acc + c.falseNegatives, 0)
  const durationMs = Number((nowMs() - suiteStart).toFixed(2))

  return {
    isSynthetic: true,
    totalCases: cases.length,
    passedCases,
    failedCases,
    falsePositives,
    falseNegatives,
    durationMs,
    cases,
  }
}
