import type { PiiEntity } from '../../engine/types'

/**
 * Distinguishes checksum- or standards-verified detections (Luhn, Verhoeff,
 * libphonenumber plan, IPv4/RFC IPv6) from pattern-only matches.
 */
export function isVerifiedEntity(entity: PiiEntity): boolean {
  if (
    entity.category === 'credit_card' ||
    entity.category === 'phone' ||
    entity.category === 'ip_address'
  ) {
    return true
  }
  if (entity.category === 'aadhaar') {
    return entity.validationNote === 'Verhoeff checksum verified'
  }
  return false
}
