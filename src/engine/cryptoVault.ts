import type { PseudonymMapping } from './types'

export interface EncryptedVaultPayload {
  version: 1
  algorithm: 'AES-GCM-256'
  kdf: 'PBKDF2-SHA256'
  iterations: number
  saltBase64: string
  ivBase64: string
  ciphertextBase64: string
}

export interface VaultEntry {
  pseudonym: string
  originalValue: string
}

const PBKDF2_ITERATIONS = 100_000

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64)
  const buffer = new ArrayBuffer(binary.length)
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

async function deriveAesKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
  usage: KeyUsage[]
): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    usage
  )
}

/**
 * Encrypts pseudonym mappings locally using Web Crypto API (PBKDF2 + AES-GCM-256).
 */
export async function encryptVaultMappings(
  entries: VaultEntry[],
  passphrase: string
): Promise<EncryptedVaultPayload> {
  const salt = new Uint8Array(new ArrayBuffer(16))
  const iv = new Uint8Array(new ArrayBuffer(12))
  crypto.getRandomValues(salt)
  crypto.getRandomValues(iv)

  const key = await deriveAesKey(passphrase, salt, ['encrypt'])
  const plaintext = new TextEncoder().encode(JSON.stringify(entries))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  )

  return {
    version: 1,
    algorithm: 'AES-GCM-256',
    kdf: 'PBKDF2-SHA256',
    iterations: PBKDF2_ITERATIONS,
    saltBase64: toBase64(salt),
    ivBase64: toBase64(iv),
    ciphertextBase64: toBase64(new Uint8Array(encrypted)),
  }
}

/**
 * Decrypts a local AES-GCM vault payload using the user's passphrase.
 */
export async function decryptVaultMappings(
  payload: EncryptedVaultPayload,
  passphrase: string
): Promise<VaultEntry[]> {
  const salt = fromBase64(payload.saltBase64)
  const iv = fromBase64(payload.ivBase64)
  const ciphertext = fromBase64(payload.ciphertextBase64)

  const key = await deriveAesKey(passphrase, salt, ['decrypt'])
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  )
  const decoded = new TextDecoder().decode(decrypted)
  const parsed = JSON.parse(decoded) as unknown
  if (!Array.isArray(parsed)) {
    throw new Error('Invalid vault payload')
  }
  return parsed as VaultEntry[]
}

/**
 * Re-hydrates pseudonymized text (e.g., an LLM response referencing EMAIL_01)
 * back to original values strictly in local browser memory.
 */
export function rehydratePseudonyms(
  sanitizedOrLlmText: string,
  entries: ReadonlyArray<Pick<VaultEntry, 'pseudonym' | 'originalValue'>>
): { restoredText: string; replacementsApplied: number } {
  if (!sanitizedOrLlmText || entries.length === 0) {
    return { restoredText: sanitizedOrLlmText, replacementsApplied: 0 }
  }

  const lookup = new Map<string, string>()
  for (const item of entries) {
    if (item.pseudonym) {
      lookup.set(item.pseudonym, item.originalValue)
    }
  }

  const escapedTokens = Array.from(lookup.keys())
    .sort((a, b) => b.length - a.length)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

  if (escapedTokens.length === 0) {
    return { restoredText: sanitizedOrLlmText, replacementsApplied: 0 }
  }

  const tokenRegex = new RegExp(`\\b(${escapedTokens.join('|')})\\b`, 'g')
  let replacementsApplied = 0
  const restoredText = sanitizedOrLlmText.replace(tokenRegex, (matched) => {
    const original = lookup.get(matched)
    if (original !== undefined) {
      replacementsApplied += 1
      return original
    }
    return matched
  })

  return { restoredText, replacementsApplied }
}

/**
 * Builds deduplicated VaultEntry list from a SanitizeResult's entities & pseudonym mappings.
 */
export function buildVaultEntriesFromEntities(
  pseudonyms: PseudonymMapping[],
  entities: Array<{ replacement: string; raw: string }>
): VaultEntry[] {
  const firstRawByToken = new Map<string, string>()
  for (const ent of entities) {
    if (!firstRawByToken.has(ent.replacement)) {
      firstRawByToken.set(ent.replacement, ent.raw)
    }
  }
  return pseudonyms
    .map((p) => ({
      pseudonym: p.pseudonym,
      originalValue: firstRawByToken.get(p.pseudonym) ?? p.previewMasked,
    }))
    .filter((entry) => entry.originalValue.length > 0)
}
