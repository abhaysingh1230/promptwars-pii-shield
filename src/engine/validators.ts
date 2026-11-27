/**
 * Client-side cryptographic & structural validators for PII entities.
 * Zero external requests; deterministic execution.
 */

const VERHOEFF_D: readonly (readonly number[])[] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
]

const VERHOEFF_P: readonly (readonly number[])[] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
]

const PAN_ENTITY_TYPES: Record<string, string> = {
  P: 'Individual',
  C: 'Company',
  H: 'HUF',
  F: 'Firm',
  A: 'AOP',
  T: 'Trust',
  B: 'BOI',
  L: 'Local Authority',
  J: 'Artificial Juridical Person',
  G: 'Government',
}

/**
 * Computes Luhn mod-10 sum and validity for 13–19 digit sequences.
 */
export function luhnDiagnostics(rawDigits: string): {
  valid: boolean
  sum: number
  remainder: number
} {
  const digits = rawDigits.replace(/\D/g, '')
  if (digits.length < 13 || digits.length > 19 || /^(\d)\1+$/.test(digits)) {
    return { valid: false, sum: 0, remainder: -1 }
  }

  let sum = 0
  let shouldDouble = false

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = digits.charCodeAt(i) - 48
    if (digit < 0 || digit > 9) {
      return { valid: false, sum: 0, remainder: -1 }
    }
    if (shouldDouble) {
      digit *= 2
      if (digit > 9) {
        digit -= 9
      }
    }
    sum += digit
    shouldDouble = !shouldDouble
  }

  const remainder = sum % 10
  return { valid: remainder === 0, sum, remainder }
}

/**
 * Validates a payment card digit string (13–19 digits) using the Luhn mod-10 algorithm.
 */
export function luhnCheck(rawDigits: string): boolean {
  return luhnDiagnostics(rawDigits).valid
}

/**
 * Identifies the likely payment network brand from card IIN/BIN prefix.
 */
export function detectCardBrand(digits: string): string {
  if (/^4\d{12}(\d{3})?(\d{3})?$/.test(digits)) return 'Visa'
  if (/^3[47]\d{13}$/.test(digits)) return 'Amex'
  if (
    /^5[1-5]\d{14}$/.test(digits) ||
    /^(222[1-9]|22[3-9]\d|2[3-6]\d{2}|27[01]\d|2720)\d{12}$/.test(digits)
  ) {
    return 'Mastercard'
  }
  if (/^(6011|65|64[4-9])/.test(digits)) return 'Discover'
  if (/^(60|65|81|82|508)/.test(digits)) return 'RuPay'
  if (/^3(?:0[0-5]|[68]\d)/.test(digits)) return 'Diners Club'
  return 'Payment Card'
}

/**
 * Computes Verhoeff checksum validity for 12-digit Indian Aadhaar numbers.
 */
export function verhoeffCheck(rawDigits: string): boolean {
  const digits = rawDigits.replace(/\D/g, '')
  if (digits.length !== 12 || !/^[2-9]\d{11}$/.test(digits)) {
    return false
  }
  let checksum = 0
  for (let i = 0; i < digits.length; i++) {
    const digit = digits.charCodeAt(digits.length - 1 - i) - 48
    checksum = VERHOEFF_D[checksum][VERHOEFF_P[i % 8][digit]]
  }
  return checksum === 0
}

/**
 * Returns the holder category encoded in the 4th character of an Indian PAN.
 */
export function describePanType(pan: string): string {
  const code = pan.trim().toUpperCase().charAt(3)
  return PAN_ENTITY_TYPES[code] ?? 'PAN Entity'
}

/**
 * Validates that an IPv4 string has four 0–255 octets without leading-zero ambiguity.
 */
export function isValidIpv4(ip: string): boolean {
  const parts = ip.split('.')
  if (parts.length !== 4) return false
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return false
    if (part.length > 1 && part.startsWith('0')) return false
    const num = Number(part)
    if (num < 0 || num > 255) return false
  }
  return true
}

/**
 * Standards-based RFC 4291 / RFC 5952 IPv6 validator.
 * Supports full, compressed (::), loopback (::1), and IPv4-embedded (::ffff:192.0.2.128) forms.
 * Rejects the unspecified address (:: or 0:0:0:0:0:0:0:0) as well as malformed/overlong/incomplete values.
 */
export function isValidIpv6(rawIp: string): boolean {
  const ip = rawIp.trim()
  if (!ip || !ip.includes(':')) return false
  if (ip.includes(':::')) return false

  const doubleColonMatches = ip.match(/::/g) ?? []
  if (doubleColonMatches.length > 1) return false

  // Reject leading/trailing single colon like ":1:2" or "1:2:"
  if (
    (ip.startsWith(':') && !ip.startsWith('::')) ||
    (ip.endsWith(':') && !ip.endsWith('::'))
  ) {
    return false
  }

  // Handle optional embedded IPv4 suffix in the last 32 bits (counts as 2 hextets)
  let work = ip
  let ipv4TailHextets = 0
  if (ip.includes('.')) {
    const lastColon = ip.lastIndexOf(':')
    const ipv4Part = ip.slice(lastColon + 1)
    if (!isValidIpv4(ipv4Part)) return false
    ipv4TailHextets = 2
    work = ip.slice(0, lastColon)
    // Case like "::192.0.2.128" -> work became ":" (restore "::" prefix marker)
    if (work === ':') {
      work = '::'
    } else if (work.endsWith(':')) {
      // e.g. "64:ff9b::192.0.2.33" -> work ended with "::" before slicing lastColon -> work is "64:ff9b:"
      if (ip.slice(0, lastColon + 1).endsWith('::')) {
        work = `${work}:`
      } else {
        return false
      }
    }
  }

  const hexGroup = /^[0-9a-fA-F]{1,4}$/
  const targetHextets = 8 - ipv4TailHextets

  if (work.includes('::')) {
    const [leftStr, rightStr] = work.split('::')
    const left = leftStr ? leftStr.split(':') : []
    const right = rightStr ? rightStr.split(':') : []
    if (!left.every((g) => hexGroup.test(g))) return false
    if (!right.every((g) => hexGroup.test(g))) return false

    const explicitCount = left.length + right.length
    if (explicitCount >= targetHextets) return false

    // Reject unspecified all-zeros address (:: or ::0 or 0::0)
    const allZero =
      ipv4TailHextets === 0 &&
      [...left, ...right].every((g) => parseInt(g, 16) === 0)
    if (allZero) return false

    return true
  }

  const groups = work.split(':')
  if (groups.length !== targetHextets) return false
  if (!groups.every((g) => hexGroup.test(g))) return false

  // Reject expanded unspecified address 0:0:0:0:0:0:0:0
  if (
    ipv4TailHextets === 0 &&
    groups.every((g) => parseInt(g, 16) === 0)
  ) {
    return false
  }

  return true
}
