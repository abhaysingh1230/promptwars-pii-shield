import { useMemo, useState } from 'react'
import {
  Lock,
  Plus,
  RefreshCw,
  Shield,
  Sliders,
  Trash2,
  Unlock,
} from 'lucide-react'
import {
  buildVaultEntriesFromEntities,
  encryptVaultMappings,
  rehydratePseudonyms,
} from '../engine/cryptoVault'
import { validateCustomRegex } from '../engine/detector'
import type { CustomRule, RedactionMode, SanitizeResult } from '../engine/types'

interface VaultAndCustomPanelProps {
  result: SanitizeResult
  mode: RedactionMode
  customRules: CustomRule[]
  onAddCustomRule: (rule: CustomRule) => void
  onToggleCustomRule: (id: string) => void
  onDeleteCustomRule: (id: string) => void
}

const PRESET_CUSTOM_RULES: ReadonlyArray<Omit<CustomRule, 'id' | 'enabled'>> = [
  {
    label: 'Indian IFSC Code',
    pattern: '\\b[A-Z]{4}0[A-Z0-9]{6}\\b',
    tokenPrefix: 'IFSC',
  },
  {
    label: 'API / Secret Key',
    pattern: '\\b(?:sk|pk|AIza)[_-]?[A-Za-z0-9_-]{16,}\\b',
    tokenPrefix: 'APIKEY',
  },
  {
    label: 'Employee ID',
    pattern: '\\bEMP-\\d{3,6}\\b',
    tokenPrefix: 'EMPID',
  },
]

export function VaultAndCustomPanel({
  result,
  mode,
  customRules,
  onAddCustomRule,
  onToggleCustomRule,
  onDeleteCustomRule,
}: VaultAndCustomPanelProps) {
  const [label, setLabel] = useState('')
  const [pattern, setPattern] = useState('')
  const [ruleError, setRuleError] = useState<string | null>(null)

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

  function handleAddRule() {
    const cleanLabel = label.trim()
    const cleanPattern = pattern.trim()
    if (!cleanLabel) {
      setRuleError('Provide a short rule label (e.g., Employee ID).')
      return
    }
    const regexErr = validateCustomRegex(cleanPattern)
    if (regexErr) {
      setRuleError(regexErr)
      return
    }
    setRuleError(null)
    onAddCustomRule({
      id: `rule-${Date.now()}`,
      label: cleanLabel,
      pattern: cleanPattern,
      tokenPrefix: cleanLabel.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'CUSTOM',
      enabled: true,
    })
    setLabel('')
    setPattern('')
  }

  function handleAddPreset(preset: Omit<CustomRule, 'id' | 'enabled'>) {
    const exists = customRules.some((r) => r.pattern === preset.pattern)
    if (exists) return
    onAddCustomRule({
      ...preset,
      id: `preset-${preset.tokenPrefix}-${Date.now()}`,
      enabled: true,
    })
  }

  async function handleExportEncryptedVault() {
    if (vaultEntries.length === 0) {
      setVaultStatus('Switch to Consistent Pseudonym mode with detected PII first.')
      return
    }
    if (vaultPassphrase.length < 6) {
      setVaultStatus('Enter a passphrase of at least 6 characters for AES-GCM encryption.')
      return
    }
    const payload = await encryptVaultMappings(vaultEntries, vaultPassphrase)
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'pii-pseudonym-vault.enc.json'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    setVaultStatus('Exported AES-GCM-256 encrypted local vault key.')
  }

  return (
    <section
      aria-label="Custom Rules and Reversible Pseudonym Vault"
      className="grid gap-4 lg:grid-cols-12"
    >
      {/* Left: Custom Client-Side Regex Rule Builder */}
      <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5 lg:col-span-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-fuchsia-300" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-white">
              Custom Secret &amp; Regex Rules
            </h2>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_CUSTOM_RULES.map((preset) => (
              <button
                key={preset.tokenPrefix}
                type="button"
                onClick={() => handleAddPreset(preset)}
                className="rounded-md border border-fuchsia-500/30 bg-fuchsia-500/10 px-2 py-0.5 text-[11px] font-medium text-fuchsia-200 transition hover:bg-fuchsia-500/20"
              >
                + {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-12">
          <input
            type="text"
            aria-label="Custom rule label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (e.g. IFSC Code)"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none sm:col-span-4"
          />
          <input
            type="text"
            aria-label="Custom rule regex pattern"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="Regex (e.g. \b[A-Z]{4}0[A-Z0-9]{6}\b)"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none sm:col-span-6"
          />
          <button
            type="button"
            onClick={handleAddRule}
            className="inline-flex items-center justify-center gap-1 rounded-lg bg-fuchsia-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-fuchsia-400 sm:col-span-2"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Add</span>
          </button>
        </div>

        {ruleError && (
          <p role="alert" className="text-xs text-rose-300">
            {ruleError}
          </p>
        )}

        {customRules.length === 0 ? (
          <p className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-500">
            No custom rules active. Click a preset above (IFSC, API Keys, Employee ID) or add your own regex.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {customRules.map((rule) => (
              <li
                key={rule.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs"
              >
                <label className="flex min-w-0 cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={() => onToggleCustomRule(rule.id)}
                    className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 text-fuchsia-400"
                  />
                  <span className="font-semibold text-slate-200">
                    {rule.label}
                  </span>
                  <code className="truncate font-mono text-[11px] text-slate-400">
                    /{rule.pattern}/g
                  </code>
                </label>
                <button
                  type="button"
                  onClick={() => onDeleteCustomRule(rule.id)}
                  aria-label={`Remove custom rule ${rule.label}`}
                  className="text-slate-500 hover:text-rose-300"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Right: Round-Trip LLM De-Pseudonymization & AES-GCM Vault */}
      <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5 lg:col-span-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-emerald-300" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-white">
              Round-Trip Re-Hydration &amp; AES-GCM Vault
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setRestoreInput(result.sanitizedText)}
            disabled={mode !== 'pseudonym' || !result.sanitizedText}
            className="inline-flex items-center gap-1 rounded-md border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Unlock className="h-3 w-3" aria-hidden="true" />
            <span>Load Pseudonymized Output</span>
          </button>
        </div>

        <p className="text-xs text-slate-400">
          {mode === 'pseudonym'
            ? 'Paste sanitized text or an AI summary referencing EMAIL_01 / CARD_01 to restore original PII locally in-browser.'
            : 'Switch Redaction Mode to "Consistent Pseudonym" to unlock round-trip local restoration and AES-GCM key export.'}
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <textarea
            aria-label="Pseudonymized text to restore locally"
            value={restoreInput}
            onChange={(e) => setRestoreInput(e.target.value)}
            placeholder="e.g. Escalate ticket for EMAIL_01 regarding CARD_01..."
            rows={4}
            className="custom-scrollbar w-full rounded-xl border border-slate-800 bg-slate-950/70 p-3 font-mono text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
          />
          <div
            aria-label="Locally restored output"
            className="custom-scrollbar h-[106px] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-slate-800 bg-slate-950/90 p-3 font-mono text-xs text-emerald-200"
          >
            {restoreInput ? (
              restoredOutput.restoredText
            ) : (
              <span className="text-slate-500">
                Restored text preview appears here ({restoredOutput.replacementsApplied} tokens restored)...
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-800/80 pt-3">
          <Lock className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
          <input
            type="password"
            aria-label="Vault encryption passphrase"
            value={vaultPassphrase}
            onChange={(e) => setVaultPassphrase(e.target.value)}
            placeholder="Passphrase (min 6 chars)"
            className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleExportEncryptedVault}
            className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-1 text-xs font-medium text-cyan-200 transition hover:bg-cyan-500/25"
          >
            <Shield className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Export AES-GCM Key</span>
          </button>
          {vaultStatus && (
            <span className="text-[11px] text-cyan-300">{vaultStatus}</span>
          )}
        </div>
      </div>
    </section>
  )
}
