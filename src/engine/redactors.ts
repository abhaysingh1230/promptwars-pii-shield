import type {
  FullMaskStyle,
  PiiCategory,
  PseudonymMapping,
  RedactionMode,
} from './types'

const PSEUDONYM_PREFIX: Record<PiiCategory, string> = {
  credit_card: 'CARD',
  email: 'EMAIL',
  pan: 'PAN',
  aadhaar: 'AADHAAR',
  ip_address: 'IP',
  phone: 'PHONE',
  custom: 'SECRET',
}

/**
 * Produces a canonical key for recurring entity consistency in Pseudonymization mode.
 * For example, "Alice@Corp.com" and "alice@corp.com", or "+91 98765 43210" and "9876543210",
 * resolve to the same pseudonym token within a document.
 */
export function normalizeEntityKey(category: PiiCategory, raw: string): string {
  switch (category) {
    case 'email':
    case 'ip_address':
      return raw.trim().toLowerCase()
    case 'pan':
      return raw.trim().toUpperCase()
    case 'custom':
      return raw.trim()
    case 'credit_card':
    case 'aadhaar':
      return raw.replace(/\D/g, '')
    case 'phone': {
      const digits = raw.replace(/\D/g, '')
      if (digits.length === 12 && digits.startsWith('91')) {
        return digits.slice(2)
      }
      if (digits.length === 11 && digits.startsWith('0')) {
        return digits.slice(1)
      }
      return digits
    }
  }
}

/**
 * Full Mask mode: replaces sensitive text with fixed redaction blocks.
 */
export function maskFull(
  category: PiiCategory,
  style: FullMaskStyle = 'generic'
): string {
  if (style === 'typed') {
    return `[REDACTED_${PSEUDONYM_PREFIX[category]}]`
  }
  return '[REDACTED]'
}

/**
 * Partial Mask mode: preserves safe trailing/structural context for verification
 * while concealing sensitive identifiers.
 */
export function maskPartial(category: PiiCategory, raw: string): string {
  switch (category) {
    case 'credit_card': {
      const digits = raw.replace(/\D/g, '')
      const last4 = digits.slice(-4)
      if (digits.length === 15) {
        return `XXXX-XXXXXX-X${last4}`
      }
      return `XXXX-XXXX-XXXX-${last4}`
    }
    case 'aadhaar': {
      const digits = raw.replace(/\D/g, '')
      return `XXXX-XXXX-${digits.slice(-4)}`
    }
    case 'email': {
      const atIdx = raw.indexOf('@')
      if (atIdx <= 0) return '[REDACTED]'
      const local = raw.slice(0, atIdx)
      const domain = raw.slice(atIdx + 1)
      const visible = local.length > 1 ? local.slice(0, 1) : ''
      return `${visible}***@${domain}`
    }
    case 'phone': {
      const digits = raw.replace(/\D/g, '')
      const last4 = digits.slice(-4)
      const hasPlus = raw.trim().startsWith('+')
      if (hasPlus && digits.length > 10) {
        const ccLen = digits.length - 10
        const cc = digits.slice(0, ccLen)
        return `+${cc} ******${last4}`
      }
      const hiddenCount = Math.max(4, digits.length - 4)
      return `${'X'.repeat(hiddenCount)}${last4}`
    }
    case 'pan': {
      const clean = raw.trim().toUpperCase()
      return `${clean.slice(0, 2)}*****${clean.slice(-3)}`
    }
    case 'ip_address': {
      if (raw.includes(':')) {
        const parts = raw.split(':')
        const prefix = parts.slice(0, 2).join(':')
        return `${prefix}:****:****`
      }
      const octets = raw.split('.')
      return `${octets[0]}.${octets[1]}.***.***`
    }
    case 'custom': {
      if (raw.length <= 4) return '****'
      return `${raw.slice(0, 2)}${'*'.repeat(Math.min(8, raw.length - 4))}${raw.slice(-2)}`
    }
  }
}

/**
 * Tracks consistent pseudonym assignments across a single document or CSV table.
 */
export class PseudonymRegistry {
  private readonly counters: Record<PiiCategory, number> = {
    credit_card: 0,
    email: 0,
    pan: 0,
    aadhaar: 0,
    ip_address: 0,
    phone: 0,
    custom: 0,
  }

  private readonly map = new Map<string, PseudonymMapping>()

  assign(category: PiiCategory, raw: string): string {
    const normalizedKey = normalizeEntityKey(category, raw)
    const compositeKey = `${category}::${normalizedKey}`
    const existing = this.map.get(compositeKey)

    if (existing) {
      existing.occurrences += 1
      return existing.pseudonym
    }

    this.counters[category] += 1
    const index = String(this.counters[category]).padStart(2, '0')
    const pseudonym = `${PSEUDONYM_PREFIX[category]}_${index}`

    this.map.set(compositeKey, {
      category,
      normalizedKey,
      previewMasked: maskPartial(category, raw),
      pseudonym,
      occurrences: 1,
    })

    return pseudonym
  }

  getMappings(): PseudonymMapping[] {
    return Array.from(this.map.values())
  }
}

/**
 * Formats a replacement token using the selected redaction mode.
 */
export function redactEntity(
  category: PiiCategory,
  raw: string,
  mode: RedactionMode,
  registry: PseudonymRegistry,
  fullMaskStyle: FullMaskStyle = 'generic'
): string {
  switch (mode) {
    case 'full':
      return maskFull(category, fullMaskStyle)
    case 'partial':
      return maskPartial(category, raw)
    case 'pseudonym':
      return registry.assign(category, raw)
  }
}
