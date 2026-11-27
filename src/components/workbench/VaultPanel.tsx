import { useMemo, useState } from 'react'
import { Lock, Shield, Unlock } from 'lucide-react'
import {
  MIN_VAULT_PASSPHRASE_LENGTH,
  PBKDF2_ITERATIONS,
  buildVaultEntriesFromEntities,
  encryptVaultMappings,
  rehydratePseudonyms,
  validateVaultPassphrase,
} from '../../engine/cryptoVault'
import type { RedactionMode, SanitizeResult } from '../../engine/types'
import { triggerClientDownload } from '../../utils/download'

interface VaultPanelProps {
  result: SanitizeResult
  mode: RedactionMode
}

/**
 * Allows local pseudonym restoration in memory and passphrase-protected AES-GCM-256 export.
 */
export function VaultPanel({ result, mode }: VaultPanelProps) {
  const [restoreInput, setRestoreInput] = useState('')
  const [vaultPassphrase, setVaultPassphrase] = useState('')
  const [vaultStatus, setVaultStatus] = useState<string | null>(null)

  const vaultEntries = useMemo(
    () => buildVaultEntriesFromEntities(result.pseudonyms, result.entities),
    [result.pseudonyms, result.entities]
  )

  const restoredOutput = useMemo(
    () => rehydratePseudonyms(restoreInput, vaultEntries),
    [restoreInput, vaultEntries]
  )

  async function handleExportEncryptedVault() {
    if (vaultEntries.length === 0) {
      setVaultStatus(
        'Switch to Pseudonymization mode with detected PII first.'
      )
      return
    }
    const passphraseError = validateVaultPassphrase(vaultPassphrase)
    if (passphraseError) {
      setVaultStatus(passphraseError)
      return
    }
    const payload = await encryptVaultMappings(vaultEntries, vaultPassphrase)
    triggerClientDownload(
      JSON.stringify(payload, null, 2),
      'pii-pseudonym-vault.enc.json',
      'application/json;charset=utf-8'
    )
    setVaultStatus(
      `Exported AES-GCM-256 vault (${PBKDF2_ITERATIONS.toLocaleString()} PBKDF2 iterations).`
    )
  }

  return (
    <div
      id="panel-vault"
      role="tabpanel"
      aria-labelledby="tab-vault"
      className="space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[var(--text-secondary)]">
          {mode === 'pseudonym'
            ? 'Restore pseudonymized tokens locally or export an AES-GCM-256 encrypted mapping file.'
            : 'Switch Redaction mode above to Pseudonymization to enable local restoration and AES-GCM export.'}
        </p>
        <button
          type="button"
          onClick={() => setRestoreInput(result.sanitizedText)}
          disabled={mode !== 'pseudonym' || !result.sanitizedText}
          className="transition-ui inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border-strong)] bg-[var(--bg-panel)] px-3 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--border-accent)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Unlock size={16} strokeWidth={1.5} aria-hidden="true" />
          <span>Load pseudonymized output</span>
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <textarea
          aria-label="Pseudonymized text to restore locally"
          value={restoreInput}
          onChange={(e) => setRestoreInput(e.target.value)}
          placeholder="Paste text containing EMAIL_01 or CARD_01"
          rows={3}
          className="custom-scrollbar w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-recessed)] p-3 font-mono text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-solid)] focus:outline-none"
        />
        <div
          aria-label="Locally restored output"
          className="custom-scrollbar h-24 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-recessed)] p-3 font-mono text-xs text-[var(--text-primary)]"
        >
          {restoreInput ? (
            restoredOutput.restoredText
          ) : (
            <span className="text-[var(--text-muted)]">
              Restored text appears here ({restoredOutput.replacementsApplied}{' '}
              tokens restored)
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-3">
        <Lock
          size={16}
          strokeWidth={1.5}
          className="text-[var(--text-secondary)]"
          aria-hidden="true"
        />
        <input
          type="password"
          aria-label="Vault encryption passphrase"
          value={vaultPassphrase}
          onChange={(e) => setVaultPassphrase(e.target.value)}
          placeholder={`Passphrase (min ${MIN_VAULT_PASSPHRASE_LENGTH} chars, mixed)`}
          className="h-9 min-w-56 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-recessed)] px-3 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-solid)] focus:outline-none"
        />
        <button
          type="button"
          onClick={handleExportEncryptedVault}
          className="transition-ui inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-panel)] px-3 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--border-accent)]"
        >
          <Shield size={16} strokeWidth={1.5} aria-hidden="true" />
          <span>Export AES-GCM key</span>
        </button>
        <span className="font-mono text-xs text-[var(--text-muted)]">
          PBKDF2-SHA256 ({PBKDF2_ITERATIONS.toLocaleString()} iter) + AES-GCM-256
        </span>
        {vaultStatus && (
          <span role="status" className="text-xs text-[var(--text-accent)]">
            {vaultStatus}
          </span>
        )}
      </div>
    </div>
  )
}
