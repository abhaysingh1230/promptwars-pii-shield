import {
  PseudonymRegistry,
  normalizeEntityKey,
  redactEntity,
} from './redactors'
import {
  ALL_CATEGORIES,
  PII_CATEGORY_META,
  type CustomRule,
  type DiffSegment,
  type LuhnRejectedCandidate,
  type PiiCandidate,
  type PiiCategory,
  type PiiEntity,
  type SanitizeOptions,
  type SanitizeResult,
} from './types'
import {
  describePanType,
  detectCardBrand,
  isValidIpv4,
  isValidIpv6,
  luhnDiagnostics,
  verhoeffCheck,
} from './validators'

const MAX_CANDIDATE_SCAN_LENGTH = 5_000_000

const EMAIL_REGEX =
  /(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?![A-Za-z0-9])/g
const PAN_UPPER_REGEX = /(?<![A-Za-z0-9])[A-Z]{5}[0-9]{4}[A-Z](?![A-Za-z0-9])/g
const PAN_MIXED_REGEX =
  /(?<![A-Za-z0-9])[A-Za-z]{3}[PCHFATBLJGpchfatbljg][A-Za-z][0-9]{4}[A-Za-z](?![A-Za-z0-9])/g
const CARD_CANDIDATE_REGEX = /(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g
const AADHAAR_SPACED_REGEX =
  /(?<!\d[\s-])(?<!\d)[1-9]\d{3}(?:[\s-]\d{4}){2}(?![\s-]?\d)/g
const AADHAAR_PLAIN_REGEX = /(?<!\d)[2-9]\d{11}(?!\d)/g
const IPV4_REGEX =
  /(?<![\d.])(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?![\d.])/g
const IPV6_REGEX =
  /(?:(?<=^)|(?<=[\s,|(["'=;])|(?<=IPv6:)|(?<=ipv6:))(?:[0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}(?![:\w])/g
const PHONE_REGEX =
  /(?<![A-Za-z0-9])(?:\+91[\s.-]?[6-9]\d{4}[\s.-]?\d{5}|\+91[\s.-]?[6-9]\d{9}|0[6-9]\d{9}|[6-9]\d{4}[\s-]\d{5}|[6-9]\d{9}|\+(?:[1-9]\d{0,2})[\s.-]?(?:\(\d{1,4}\)[\s.-]?)?(?:\d[\s.-]?){6,13}\d)(?![A-Za-z0-9])/g

/**
 * Heuristic detector for catastrophic ReDoS patterns such as nested quantifiers
 * like (a+)+, (.*)*, or quantified alternations with overlapping groups.
 */
const NESTED_QUANTIFIER_REGEX =
  /\((?:[^()\\]|\\.)*[+*](?:[^()\\]|\\.)*\)[+*?]|\((?:[^()\\]|\\.)*\|(?:[^()\\]|\\.)*\)[+*{]/

interface RawDetectionOutput {
  candidates: PiiCandidate[]
  luhnRejected: LuhnRejectedCandidate[]
}

function createEmptyCounts(): Record<PiiCategory, number> {
  return {
    credit_card: 0,
    pan: 0,
    aadhaar: 0,
    email: 0,
    phone: 0,
    ip_address: 0,
    custom: 0,
  }
}

/**
 * Validates a user-supplied custom regex pattern before compiling.
 * Rejects empty matches, syntax errors, and nested-quantifier ReDoS patterns.
 */
export function validateCustomRegex(pattern: string): string | null {
  const trimmed = pattern.trim()
  if (!trimmed) return 'Pattern cannot be empty.'
  if (trimmed.length > 200) return 'Pattern exceeds 200-character safety limit.'
  if (NESTED_QUANTIFIER_REGEX.test(trimmed)) {
    return 'Pattern rejected: nested quantifiers may freeze the browser (ReDoS risk).'
  }
  try {
    const compiled = new RegExp(trimmed, 'g')
    if (compiled.test('')) {
      return 'Pattern must not match empty strings.'
    }
    return null
  } catch (err) {
    return err instanceof Error ? err.message : 'Invalid regular expression.'
  }
}

function collectPatternCandidates(
  text: string,
  enabledCategories: Record<PiiCategory, boolean>,
  customRules: CustomRule[] = []
): RawDetectionOutput {
  const candidates: PiiCandidate[] = []
  const luhnRejected: LuhnRejectedCandidate[] = []

  if (enabledCategories.credit_card) {
    CARD_CANDIDATE_REGEX.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = CARD_CANDIDATE_REGEX.exec(text)) !== null) {
      const raw = match[0]
      const digits = raw.replace(/\D/g, '')
      if (digits.length < 13 || digits.length > 19) continue
      if (/^\d{4}-\d{2}-\d{2}/.test(raw)) continue

      const luhn = luhnDiagnostics(digits)
      if (luhn.valid) {
        candidates.push({
          category: 'credit_card',
          raw,
          normalized: digits,
          start: match.index,
          end: match.index + raw.length,
          confidence: 'high',
          validationNote: `${detectCardBrand(digits)} · Luhn sum ${luhn.sum} (mod 10 = 0)`,
        })
      } else {
        luhnRejected.push({
          raw,
          digits,
          start: match.index,
          end: match.index + raw.length,
          reason:
            luhn.remainder >= 0
              ? `Failed Luhn mod-10 (sum ${luhn.sum}, rem ${luhn.remainder})`
              : 'Failed Luhn mod-10 checksum',
        })
      }
    }
  }

  if (enabledCategories.email) {
    EMAIL_REGEX.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = EMAIL_REGEX.exec(text)) !== null) {
      const raw = match[0]
      candidates.push({
        category: 'email',
        raw,
        normalized: normalizeEntityKey('email', raw),
        start: match.index,
        end: match.index + raw.length,
        confidence: 'high',
      })
    }
  }

  if (enabledCategories.pan) {
    const seenPanStarts = new Set<number>()
    for (const regex of [PAN_UPPER_REGEX, PAN_MIXED_REGEX]) {
      regex.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = regex.exec(text)) !== null) {
        if (seenPanStarts.has(match.index)) continue
        seenPanStarts.add(match.index)
        const raw = match[0]
        const isUppercase = raw === raw.toUpperCase()
        candidates.push({
          category: 'pan',
          raw,
          normalized: normalizeEntityKey('pan', raw),
          start: match.index,
          end: match.index + raw.length,
          confidence: isUppercase ? 'high' : 'medium',
          validationNote: `${describePanType(raw)}${isUppercase ? '' : ' · mixed-case match'}`,
        })
      }
    }
  }

  if (enabledCategories.aadhaar) {
    const seenAadhaarStarts = new Set<number>()
    for (const regex of [AADHAAR_SPACED_REGEX, AADHAAR_PLAIN_REGEX]) {
      regex.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = regex.exec(text)) !== null) {
        if (seenAadhaarStarts.has(match.index)) continue
        seenAadhaarStarts.add(match.index)
        const raw = match[0]
        const digits = raw.replace(/\D/g, '')
        const verhoeffOk = verhoeffCheck(digits)
        candidates.push({
          category: 'aadhaar',
          raw,
          normalized: digits,
          start: match.index,
          end: match.index + raw.length,
          confidence: verhoeffOk ? 'high' : 'medium',
          validationNote: verhoeffOk
            ? 'Verhoeff checksum verified'
            : 'Format-matched · checksum unverified',
        })
      }
    }
  }

  if (enabledCategories.ip_address) {
    IPV4_REGEX.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = IPV4_REGEX.exec(text)) !== null) {
      const raw = match[0]
      const prevChar = match.index > 0 ? text[match.index - 1] : ''
      if (prevChar === 'v' || prevChar === 'V') continue
      if (!isValidIpv4(raw)) continue
      candidates.push({
        category: 'ip_address',
        raw,
        normalized: raw,
        start: match.index,
        end: match.index + raw.length,
        confidence: 'high',
        validationNote: 'IPv4',
      })
    }

    IPV6_REGEX.lastIndex = 0
    while ((match = IPV6_REGEX.exec(text)) !== null) {
      const raw = match[0]
      if (!isValidIpv6(raw)) continue
      candidates.push({
        category: 'ip_address',
        raw,
        normalized: raw.toLowerCase(),
        start: match.index,
        end: match.index + raw.length,
        confidence: 'high',
        validationNote: 'IPv6',
      })
    }
  }

  if (enabledCategories.phone) {
    PHONE_REGEX.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = PHONE_REGEX.exec(text)) !== null) {
      const raw = match[0].trim()
      const digits = raw.replace(/\D/g, '')
      if (digits.length < 8 || digits.length > 15) continue
      // Avoid plain 8-digit non-prefixed numbers; require 10+ digits unless international + prefixed
      if (!raw.startsWith('+') && digits.length < 10) continue
      // Avoid matching dates like 2026-11-27
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) continue
      candidates.push({
        category: 'phone',
        raw,
        normalized: normalizeEntityKey('phone', raw),
        start: match.index,
        end: match.index + raw.length,
        confidence: 'high',
      })
    }
  }

  if (enabledCategories.custom && customRules.length > 0) {
    for (const rule of customRules) {
      if (!rule.enabled) continue
      if (validateCustomRegex(rule.pattern) !== null) continue
      const regex = new RegExp(rule.pattern, 'g')
      let match: RegExpExecArray | null
      let guard = 0
      while ((match = regex.exec(text)) !== null && guard < 5000) {
        guard += 1
        const raw = match[0]
        if (!raw) {
          regex.lastIndex += 1
          continue
        }
        candidates.push({
          category: 'custom',
          raw,
          normalized: raw,
          start: match.index,
          end: match.index + raw.length,
          confidence: 'medium',
          validationNote: `Custom rule: ${rule.label}`,
        })
      }
    }
  }

  return { candidates, luhnRejected }
}

/**
 * Resolves overlapping candidate spans deterministically by start index,
 * then higher category priority, then longer span length.
 */
function resolveOverlaps(candidates: PiiCandidate[]): PiiCandidate[] {
  const sorted = [...candidates].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start
    const prioDiff =
      PII_CATEGORY_META[a.category].priority -
      PII_CATEGORY_META[b.category].priority
    if (prioDiff !== 0) return prioDiff
    return b.end - a.end
  })

  const accepted: PiiCandidate[] = []
  let lastEnd = -1

  for (const item of sorted) {
    if (item.start >= lastEnd) {
      accepted.push(item)
      lastEnd = item.end
      continue
    }

    const prev = accepted[accepted.length - 1]
    const prevPrio = PII_CATEGORY_META[prev.category].priority
    const itemPrio = PII_CATEGORY_META[item.category].priority
    if (
      item.start === prev.start &&
      (itemPrio < prevPrio ||
        (itemPrio === prevPrio && item.end > prev.end))
    ) {
      accepted[accepted.length - 1] = item
      lastEnd = item.end
    }
  }

  return accepted
}

function filterLuhnRejected(
  rejected: LuhnRejectedCandidate[],
  accepted: PiiCandidate[]
): LuhnRejectedCandidate[] {
  return rejected.filter(
    (cand) =>
      !accepted.some(
        (ent) => cand.start < ent.end && cand.end > ent.start
      )
  )
}

/**
 * Runs client-side PII detection, validation, and redaction on raw text.
 */
export function sanitizeText(
  text: string,
  options: SanitizeOptions,
  sharedRegistry?: PseudonymRegistry
): SanitizeResult {
  const startTime = performance.now()
  const safeText =
    text.length > MAX_CANDIDATE_SCAN_LENGTH
      ? text.slice(0, MAX_CANDIDATE_SCAN_LENGTH)
      : text

  const registry = sharedRegistry ?? new PseudonymRegistry()
  const { candidates, luhnRejected } = collectPatternCandidates(
    safeText,
    options.enabledCategories,
    options.customRules ?? []
  )
  const resolved = resolveOverlaps(candidates)
  const cleanLuhnRejected = filterLuhnRejected(luhnRejected, resolved)

  const countsByCategory = createEmptyCounts()
  const entities: PiiEntity[] = []
  const originalSegments: DiffSegment[] = []
  const sanitizedSegments: DiffSegment[] = []
  const sanitizedChunks: string[] = []

  let cursor = 0

  for (let i = 0; i < resolved.length; i++) {
    const item = resolved[i]
    if (item.start > cursor) {
      const plain = safeText.slice(cursor, item.start)
      originalSegments.push({ type: 'text', text: plain })
      sanitizedSegments.push({ type: 'text', text: plain })
      sanitizedChunks.push(plain)
    }

    const replacement = redactEntity(
      item.category,
      item.raw,
      options.mode,
      registry,
      options.fullMaskStyle ?? 'generic'
    )

    const entity: PiiEntity = {
      ...item,
      id: `pii-${i + 1}`,
      replacement,
    }

    entities.push(entity)
    countsByCategory[item.category] += 1

    originalSegments.push({ type: 'entity', text: item.raw, entity })
    sanitizedSegments.push({ type: 'entity', text: replacement, entity })
    sanitizedChunks.push(replacement)

    cursor = item.end
  }

  if (cursor < safeText.length) {
    const tail = safeText.slice(cursor)
    originalSegments.push({ type: 'text', text: tail })
    sanitizedSegments.push({ type: 'text', text: tail })
    sanitizedChunks.push(tail)
  }

  const totalEntities = ALL_CATEGORIES.reduce(
    (sum, cat) => sum + countsByCategory[cat],
    0
  )

  return {
    originalText: safeText,
    sanitizedText: sanitizedChunks.join(''),
    entities,
    luhnRejected: cleanLuhnRejected,
    countsByCategory,
    totalEntities,
    pseudonyms: registry.getMappings(),
    originalSegments,
    sanitizedSegments,
    processingMs: Number((performance.now() - startTime).toFixed(2)),
    isCsv: Boolean(options.isCsv),
  }
}
