import { useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  FileJson,
  KeyRound,
  Lock,
  Plus,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Trash2,
  Unlock,
} from 'lucide-react'
import type { OnDeviceAdviceResult } from '../engine/chromeAi'
import {
  buildVaultEntriesFromEntities,
  encryptVaultMappings,
  rehydratePseudonyms,
} from '../engine/cryptoVault'
import { validateCustomRegex } from '../engine/detector'
import { inspectClientNetworkEgress } from '../engine/networkAudit'
import {
  PII_CATEGORY_META,
  type CustomRule,
  type RedactionMode,
  type SanitizeResult,
} from '../engine/types'

interface SecurityWorkbenchProps {
  result: SanitizeResult
  mode: RedactionMode
  privacyAdvice: OnDeviceAdviceResult
  customRules: CustomRule[]
  onAddCustomRule: (rule: CustomRule) => void
  onToggleCustomRule: (id: string) => void
  onDeleteCustomRule: (id: string) => void
  onDownloadAuditJson: () => void
}

type WorkbenchTab = 'audit' | 'rules' | 'vault'

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

export function SecurityWorkbench({
  result,
  mode,
  privacyAdvice,
  customRules,
  onAddCustomRule,
  onToggleCustomRule,
  onDeleteCustomRule,
  onDownloadAuditJson,
}: SecurityWorkbenchProps) {
  const [activeTab, setActiveTab] = useState<WorkbenchTab>('audit')
  const [label, setLabel] = useState('')
  const [pattern, setPattern] = useState('')
  const [ruleError, setRuleError] = useState<string | null>(null)
  const [restoreInput, setRestoreInput] = useState('')
  const [vaultPassphrase, setVaultPassphrase] = useState('')
  const [vaultStatus, setVaultStatus] = useState<string | null>(null)

  const networkAudit = inspectClientNetworkEgress()

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
      tokenPrefix:
        cleanLabel
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '')
          .slice(0, 8) || 'CUSTOM',
      enabled: true,
    })
    setLabel('')
    setPattern('')
  }

  function handleAddPreset(preset: Omit<CustomRule, 'id' | 'enabled'>) {
    if (customRules.some((r) => r.pattern === preset.pattern)) return
    onAddCustomRule({
      ...preset,
      id: `preset-${preset.tokenPrefix}-${Date.now()}`,
      enabled: true,
    })
  }

  async function handleExportEncryptedVault() {
    if (vaultEntries.length === 0) {
      setVaultStatus(
        'Switch to Consistent Pseudonym mode with detected PII first.'
      )
      return
    }
    if (vaultPassphrase.length < 6) {
      setVaultStatus(
        'Enter a passphrase of at least 6 characters for AES-GCM encryption.'
      )
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
      aria-labelledby="audit-heading"
      className="space-y-4 rounded-2xl border border-slate-800/90 bg-slate-900/65 p-4 ring-1 ring-white/[0.03] backdrop-blur sm:p-5"
    >
      {/* Top Bar: Telemetry KPIs + Tab Switcher */}
      <div className="flex flex-col gap-3 border-b border-slate-800/80 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Activity className="h-4 w-4 text-cyan-400" aria-hidden="true" />
          <h2 id="audit-heading" className="text-sm font-semibold text-white">
            Detection Audit &amp; Security Workbench
          </h2>
          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] text-emerald-300">
            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
            <span>{networkAudit.externalApiCalls} external API calls</span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="Security workbench sections"
            className="inline-flex flex-wrap rounded-xl border border-slate-800 bg-slate-950/80 p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'audit'}
              onClick={() => setActiveTab('audit')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                activeTab === 'audit'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldAlert className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
              <span>Audit &amp; Luhn ({result.totalEntities})</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'rules'}
              onClick={() => setActiveTab('rules')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                activeTab === 'rules'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="h-3.5 w-3.5 text-fuchsia-300" aria-hidden="true" />
              <span>Custom Rules ({customRules.length})</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'vault'}
              onClick={() => setActiveTab('vault')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                activeTab === 'vault'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <KeyRound className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
              <span>Round-Trip Vault</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onDownloadAuditJson}
            disabled={!result.originalText}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-cyan-500/50 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <FileJson className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
            <span>Export Safe Audit JSON</span>
          </button>
        </div>
      </div>

      {/* Compact Always-Visible Metrics Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950/75 px-3.5 py-2.5">
          <p className="text-[11px] font-medium text-slate-400">PII Redacted</p>
          <p className="mt-0.5 font-mono text-lg font-bold text-white">
            {result.totalEntities}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/75 px-3.5 py-2.5">
          <p className="text-[11px] font-medium text-slate-400">Luhn Filtered</p>
          <p className="mt-0.5 font-mono text-lg font-bold text-amber-300">
            {result.luhnRejected.length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/75 px-3.5 py-2.5">
          <p className="text-[11px] font-medium text-slate-400">Unique Tokens</p>
          <p className="mt-0.5 font-mono text-lg font-bold text-cyan-300">
            {result.pseudonyms.length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/75 px-3.5 py-2.5">
          <p className="text-[11px] font-medium text-slate-400">Scan Time</p>
          <p className="mt-0.5 font-mono text-lg font-bold text-emerald-300">
            {result.processingMs}ms
          </p>
        </div>
      </div>

      {/* Tab 1: Audit, Luhn Proof & Pseudonym Registry */}
      {activeTab === 'audit' && (
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-6">
            <div className="flex items-start gap-2.5 rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-3 text-xs text-slate-200">
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400"
                aria-hidden="true"
              />
              <div>
                <span className="font-semibold text-cyan-300">
                  {privacyAdvice.source === 'gemini-nano'
                    ? 'On-Device Gemini Nano Advisory: '
                    : 'Local Compliance Summary: '}
                </span>
                <span>{privacyAdvice.summary}</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <AlertTriangle
                  className="h-3.5 w-3.5 text-amber-300"
                  aria-hidden="true"
                />
                <span>
                  Luhn False-Positive Prevention ({result.luhnRejected.length}{' '}
                  ignored)
                </span>
              </div>
              {result.luhnRejected.length === 0 ? (
                <p className="mt-1.5 text-xs text-slate-500">
                  No non-Luhn 13–19 digit numeric strings detected in current
                  input.
                </p>
              ) : (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {result.luhnRejected.map((item, idx) => (
                    <li
                      key={`${item.digits}-${idx}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 font-mono text-[11px] text-amber-200"
                      title={item.reason}
                    >
                      <span>{item.raw}</span>
                      <span className="text-amber-400/80">• kept safe</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="space-y-2 lg:col-span-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                {mode === 'pseudonym'
                  ? 'Consistent Pseudonym Registry'
                  : 'Detected Entity Log'}
              </h3>
              <span className="text-[11px] text-slate-400">In-memory only</span>
            </div>

            {result.entities.length === 0 ? (
              <p className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-500">
                No PII entities matched with active filters.
              </p>
            ) : mode === 'pseudonym' ? (
              <div className="custom-scrollbar max-h-52 overflow-auto rounded-xl border border-slate-800 bg-slate-950/60">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-950 text-[11px] uppercase text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Token</th>
                      <th className="px-3 py-2">Category</th>
                      <th className="px-3 py-2">Masked Ref</th>
                      <th className="px-3 py-2 text-right">Hits</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {result.pseudonyms.map((m) => {
                      const meta = PII_CATEGORY_META[m.category]
                      return (
                        <tr key={m.pseudonym} className="text-slate-200">
                          <td className="px-3 py-2 font-mono font-semibold text-cyan-300">
                            {m.pseudonym}
                          </td>
                          <td className="px-3 py-2 text-slate-300">
                            {meta.shortLabel}
                          </td>
                          <td className="px-3 py-2 font-mono text-slate-400">
                            {m.previewMasked}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-slate-200">
                            {m.occurrences}×
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="custom-scrollbar max-h-52 overflow-auto rounded-xl border border-slate-800 bg-slate-950/60">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-950 text-[11px] uppercase text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Output Token</th>
                      <th className="px-3 py-2">Validation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {result.entities.slice(0, 60).map((ent) => {
                      const meta = PII_CATEGORY_META[ent.category]
                      return (
                        <tr key={ent.id} className="text-slate-200">
                          <td className="px-3 py-2 font-medium">
                            {meta.shortLabel}
                          </td>
                          <td className="px-3 py-2 font-mono text-cyan-300">
                            {ent.replacement}
                          </td>
                          <td className="px-3 py-2 text-slate-400">
                            {ent.validationNote ?? 'Regex + Boundary'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Custom Secret & Regex Rules */}
      {activeTab === 'rules' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-400">
              Add custom client-side regex rules for company secrets, IFSC
              codes, or internal employee IDs.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_CUSTOM_RULES.map((preset) => (
                <button
                  key={preset.tokenPrefix}
                  type="button"
                  onClick={() => handleAddPreset(preset)}
                  className="rounded-md border border-fuchsia-500/30 bg-fuchsia-500/10 px-2.5 py-1 text-[11px] font-medium text-fuchsia-200 transition hover:bg-fuchsia-500/20"
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
              No custom rules active yet. Click a preset above or define your
              own regex.
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
      )}

      {/* Tab 3: Round-Trip Re-Hydration & AES-GCM Vault */}
      {activeTab === 'vault' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-400">
              {mode === 'pseudonym'
                ? 'Paste sanitized text or an AI summary referencing EMAIL_01 / CARD_01 to restore original PII locally in-browser.'
                : 'Switch Redaction Mode above to "Consistent Pseudonym" to unlock round-trip local restoration and AES-GCM key export.'}
            </p>
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
                  Restored text preview appears here (
                  {restoredOutput.replacementsApplied} tokens restored)...
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
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              PBKDF2-SHA256 + AES-GCM-256
            </span>
            {vaultStatus && (
              <span className="text-[11px] text-cyan-300">{vaultStatus}</span>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
