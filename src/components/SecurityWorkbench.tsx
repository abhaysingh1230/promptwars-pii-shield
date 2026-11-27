import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileJson,
  KeyRound,
  Lock,
  Plus,
  Shield,
  ShieldAlert,
  Sliders,
  Trash2,
  Unlock,
} from 'lucide-react'
import type { OnDeviceAdviceResult } from '../engine/chromeAi'
import type { PrivacyRiskAssessment } from '../engine/compliance'
import {
  MIN_VAULT_PASSPHRASE_LENGTH,
  PBKDF2_ITERATIONS,
  buildVaultEntriesFromEntities,
  encryptVaultMappings,
  rehydratePseudonyms,
  validateVaultPassphrase,
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
  assessment: PrivacyRiskAssessment
  mode: RedactionMode
  privacyAdvice: OnDeviceAdviceResult
  customRules: CustomRule[]
  customRuleWarning: string | null
  onAddCustomRule: (rule: CustomRule) => void
  onToggleCustomRule: (id: string) => void
  onDeleteCustomRule: (id: string) => void
  onDownloadAuditJson: () => void
}

type WorkbenchTab = 'audit' | 'rules' | 'vault'

const TAB_ORDER: readonly WorkbenchTab[] = ['audit', 'rules', 'vault']

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
  assessment,
  mode,
  privacyAdvice,
  customRules,
  customRuleWarning,
  onAddCustomRule,
  onToggleCustomRule,
  onDeleteCustomRule,
  onDownloadAuditJson,
}: SecurityWorkbenchProps) {
  const [expanded, setExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<WorkbenchTab>('audit')
  const [label, setLabel] = useState('')
  const [pattern, setPattern] = useState('')
  const [ruleError, setRuleError] = useState<string | null>(null)
  const [restoreInput, setRestoreInput] = useState('')
  const [vaultPassphrase, setVaultPassphrase] = useState('')
  const [vaultStatus, setVaultStatus] = useState<string | null>(null)

  const tabRefs = useRef<Record<WorkbenchTab, HTMLButtonElement | null>>({
    audit: null,
    rules: null,
    vault: null,
  })

  const networkAudit = inspectClientNetworkEgress()

  const vaultEntries = useMemo(
    () => buildVaultEntriesFromEntities(result.pseudonyms, result.entities),
    [result.pseudonyms, result.entities]
  )

  const restoredOutput = useMemo(
    () => rehydratePseudonyms(restoreInput, vaultEntries),
    [restoreInput, vaultEntries]
  )

  function handleTabKeyDown(e: KeyboardEvent<HTMLButtonElement>, current: WorkbenchTab) {
    const idx = TAB_ORDER.indexOf(current)
    let nextIdx = idx
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % TAB_ORDER.length
    else if (e.key === 'ArrowLeft')
      nextIdx = (idx - 1 + TAB_ORDER.length) % TAB_ORDER.length
    else if (e.key === 'Home') nextIdx = 0
    else if (e.key === 'End') nextIdx = TAB_ORDER.length - 1
    else return

    e.preventDefault()
    const nextTab = TAB_ORDER[nextIdx]
    setActiveTab(nextTab)
    tabRefs.current[nextTab]?.focus()
  }

  function handleAddRule() {
    const cleanLabel = label.trim()
    const cleanPattern = pattern.trim()
    if (!cleanLabel) {
      setRuleError('Provide a short rule label (e.g. Employee ID)')
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
    setVaultStatus(
      `Exported AES-GCM-256 vault (${PBKDF2_ITERATIONS.toLocaleString()} PBKDF2 iterations).`
    )
  }

  return (
    <section
      aria-labelledby="advanced-tools-heading"
      className="instrument-panel rounded-xl border border-[#e2e8f0]/[0.08]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls="advanced-security-tools-body"
          onClick={() => setExpanded((e) => !e)}
          className="transition-ui inline-flex items-center gap-2 text-left font-display text-sm font-medium text-[#f1f5f9] hover:text-[#22d3ee] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee]"
        >
          {expanded ? (
            <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" />
          )}
          <span id="advanced-tools-heading">Advanced security tools</span>
          <span className="font-mono text-xs tabular-nums text-[#8b93a7]">
            · Luhn filtered: {result.luhnRejected.length} · Custom rules:{' '}
            {customRules.length} · Vault
          </span>
        </button>

        <button
          type="button"
          onClick={onDownloadAuditJson}
          disabled={!result.originalText || Boolean(result.csvParseError)}
          className="transition-ui inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#e2e8f0]/[0.1] bg-[#151b26] px-2.5 text-xs font-medium text-[#f1f5f9] hover:border-[#22d3ee]/50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee]"
        >
          <FileJson
            size={16}
            strokeWidth={1.5}
            className="text-[#a3a9b8]"
            aria-hidden="true"
          />
          <span>Export audit JSON</span>
        </button>
      </div>

      {expanded && (
        <div
          id="advanced-security-tools-body"
          className="space-y-4 border-t border-[#eef0f5]/[0.08] p-4"
        >
          {/* Compact Heuristic Metrics (explicitly scoped, no false guarantees) */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-lg border border-[#eef0f5]/[0.08] bg-[#090b10] p-3">
              <p className="text-xs text-[#a3a9b8]">Pattern exposure estimate</p>
              <p className="mt-1 font-mono text-xl font-medium tabular-nums text-[#eef0f5]">
                {assessment.rawRiskScore}/100 → 0
              </p>
              <p className="mt-0.5 font-mono text-xs text-[#7a8296]">
                Heuristic ({assessment.severityLabel})
              </p>
            </div>

            <div className="rounded-lg border border-[#eef0f5]/[0.08] bg-[#090b10] p-3">
              <p className="text-xs text-[#a3a9b8]">PII redacted</p>
              <p className="mt-1 font-mono text-xl font-medium tabular-nums text-[#eef0f5]">
                {result.totalEntities}
              </p>
              <p className="mt-0.5 font-mono text-xs text-[#7a8296]">
                {result.pseudonyms.length} unique tokens
              </p>
            </div>

            <div className="rounded-lg border border-[#eef0f5]/[0.08] bg-[#090b10] p-3">
              <p className="text-xs text-[#a3a9b8]">Luhn filtered</p>
              <p className="mt-1 font-mono text-xl font-medium tabular-nums text-[#eef0f5]">
                {result.luhnRejected.length}
              </p>
              <p className="mt-0.5 font-mono text-xs text-[#7a8296]">
                Non-card 16-digit IDs kept
              </p>
            </div>

            <div className="rounded-lg border border-[#eef0f5]/[0.08] bg-[#090b10] p-3">
              <p className="text-xs text-[#a3a9b8]">Runtime network check</p>
              <p className="mt-1 font-mono text-xl font-medium tabular-nums text-[#eef0f5]">
                {networkAudit.externalCalls} external
              </p>
              <p className="mt-0.5 font-mono text-xs text-[#7a8296]">
                {assessment.throughputMbPerSec} MB/s · same-origin only
              </p>
            </div>
          </div>

          {/* Keyboard-Operable Tabs */}
          <div
            role="tablist"
            aria-label="Advanced security tools sections"
            className="inline-flex flex-wrap rounded-lg border border-[#eef0f5]/[0.08] bg-[#090b10] p-0.5"
          >
            <button
              ref={(el) => {
                tabRefs.current.audit = el
              }}
              id="tab-audit"
              type="button"
              role="tab"
              aria-selected={activeTab === 'audit'}
              aria-controls="panel-audit"
              tabIndex={activeTab === 'audit' ? 0 : -1}
              onClick={() => setActiveTab('audit')}
              onKeyDown={(e) => handleTabKeyDown(e, 'audit')}
              className={`transition-ui inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee] ${
                activeTab === 'audit'
                  ? 'surface-active bg-[#161b26] text-[#eef0f5]'
                  : 'text-[#a3a9b8] hover:text-[#eef0f5]'
              }`}
            >
              <ShieldAlert size={16} strokeWidth={1.5} aria-hidden="true" />
              <span>Audit &amp; Luhn ({result.totalEntities})</span>
            </button>
            <button
              ref={(el) => {
                tabRefs.current.rules = el
              }}
              id="tab-rules"
              type="button"
              role="tab"
              aria-selected={activeTab === 'rules'}
              aria-controls="panel-rules"
              tabIndex={activeTab === 'rules' ? 0 : -1}
              onClick={() => setActiveTab('rules')}
              onKeyDown={(e) => handleTabKeyDown(e, 'rules')}
              className={`transition-ui inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee] ${
                activeTab === 'rules'
                  ? 'surface-active bg-[#161b26] text-[#eef0f5]'
                  : 'text-[#a3a9b8] hover:text-[#eef0f5]'
              }`}
            >
              <Sliders size={16} strokeWidth={1.5} aria-hidden="true" />
              <span>Custom rules ({customRules.length})</span>
            </button>
            <button
              ref={(el) => {
                tabRefs.current.vault = el
              }}
              id="tab-vault"
              type="button"
              role="tab"
              aria-selected={activeTab === 'vault'}
              aria-controls="panel-vault"
              tabIndex={activeTab === 'vault' ? 0 : -1}
              onClick={() => setActiveTab('vault')}
              onKeyDown={(e) => handleTabKeyDown(e, 'vault')}
              className={`transition-ui inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee] ${
                activeTab === 'vault'
                  ? 'surface-active bg-[#161b26] text-[#eef0f5]'
                  : 'text-[#a3a9b8] hover:text-[#eef0f5]'
              }`}
            >
              <KeyRound size={16} strokeWidth={1.5} aria-hidden="true" />
              <span>Encrypted vault</span>
            </button>
          </div>

          {activeTab === 'audit' && (
            <div
              id="panel-audit"
              role="tabpanel"
              aria-labelledby="tab-audit"
              className="grid gap-4 lg:grid-cols-12"
            >
              <div className="min-w-0 space-y-3 lg:col-span-6">
                <div className="flex items-start gap-2.5 rounded-lg border border-[#eef0f5]/[0.08] bg-[#090b10] p-3 text-xs text-[#a3a9b8]">
                  <CheckCircle2
                    size={16}
                    strokeWidth={1.5}
                    className="mt-0.5 shrink-0 text-[#4cc38a]"
                    aria-hidden="true"
                  />
                  <div>
                    <span className="font-medium text-[#eef0f5]">
                      {privacyAdvice.source === 'gemini-nano'
                        ? 'On-device Gemini Nano note: '
                        : 'Local summary: '}
                    </span>
                    <span>{privacyAdvice.summary}</span>
                  </div>
                </div>

                <div className="rounded-lg border border-[#eef0f5]/[0.08] bg-[#090b10] p-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-[#eef0f5]">
                    <AlertTriangle
                      size={16}
                      strokeWidth={1.5}
                      className="text-[#a3a9b8]"
                      aria-hidden="true"
                    />
                    <span>
                      Luhn false-positive prevention ({result.luhnRejected.length}{' '}
                      ignored)
                    </span>
                  </div>
                  {result.luhnRejected.length === 0 ? (
                    <p className="mt-1.5 text-xs text-[#7a8296]">
                      No non-Luhn 13–19 digit numeric strings detected in current
                      input.
                    </p>
                  ) : (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {result.luhnRejected.map((item, idx) => (
                        <li
                          key={`${item.digits}-${idx}`}
                          className="inline-flex items-center gap-1.5 rounded border border-[#eef0f5]/[0.1] bg-[#161b26] px-2.5 py-1 font-mono text-xs text-[#eef0f5]"
                          title={item.reason}
                        >
                          <span>{item.raw}</span>
                          <span className="text-[#7a8296]">kept safe</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="min-w-0 space-y-2 lg:col-span-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-medium text-[#a3a9b8]">
                    {mode === 'pseudonym'
                      ? 'Consistent pseudonym registry'
                      : 'Detected entity log'}
                  </h3>
                  <span className="text-xs text-[#7a8296]">In-memory only</span>
                </div>

                {result.entities.length === 0 ? (
                  <p className="rounded-lg border border-[#eef0f5]/[0.08] bg-[#090b10] p-4 text-xs text-[#7a8296]">
                    No PII entities matched with active filters.
                  </p>
                ) : mode === 'pseudonym' ? (
                  <div className="custom-scrollbar max-h-48 max-w-full overflow-x-auto overflow-y-auto rounded-lg border border-[#eef0f5]/[0.08] bg-[#090b10]">
                    <table className="w-full text-left text-xs tabular-nums">
                      <thead className="sticky top-0 bg-[#0f131b] text-xs text-[#a3a9b8]">
                        <tr>
                          <th className="px-3 py-2 font-medium">Token</th>
                          <th className="px-3 py-2 font-medium">Category</th>
                          <th className="px-3 py-2 font-medium">Masked ref</th>
                          <th className="px-3 py-2 text-right font-medium">
                            Hits
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#eef0f5]/[0.06]">
                        {result.pseudonyms.map((m) => {
                          const meta = PII_CATEGORY_META[m.category]
                          return (
                            <tr key={m.pseudonym} className="text-[#eef0f5]">
                              <td className="px-3 py-2 font-mono text-[#22d3ee]">
                                {m.pseudonym}
                              </td>
                              <td className="px-3 py-2 text-[#a3a9b8]">
                                {meta.shortLabel}
                              </td>
                              <td className="px-3 py-2 font-mono text-[#7a8296]">
                                {m.previewMasked}
                              </td>
                              <td className="px-3 py-2 text-right font-mono">
                                {m.occurrences}×
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="custom-scrollbar max-h-48 max-w-full overflow-x-auto overflow-y-auto rounded-lg border border-[#eef0f5]/[0.08] bg-[#090b10]">
                    <table className="w-full text-left text-xs tabular-nums">
                      <thead className="sticky top-0 bg-[#0f131b] text-xs text-[#a3a9b8]">
                        <tr>
                          <th className="px-3 py-2 font-medium">Type</th>
                          <th className="px-3 py-2 font-medium">Output token</th>
                          <th className="px-3 py-2 font-medium">Validation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#eef0f5]/[0.06]">
                        {result.entities.slice(0, 60).map((ent) => {
                          const meta = PII_CATEGORY_META[ent.category]
                          return (
                            <tr key={ent.id} className="text-[#eef0f5]">
                              <td className="px-3 py-2 font-medium">
                                {meta.shortLabel}
                              </td>
                              <td className="px-3 py-2 font-mono text-[#22d3ee]">
                                {ent.replacement}
                              </td>
                              <td className="px-3 py-2 text-[#7a8296]">
                                {ent.validationNote ?? 'Regex + boundary'}
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

          {activeTab === 'rules' && (
            <div
              id="panel-rules"
              role="tabpanel"
              aria-labelledby="tab-rules"
              className="space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-[#a3a9b8]">
                  Custom rules compile with Google&apos;s RE2 linear-time engine
                  (re2js) inside a Web Worker with an 800 ms watchdog.
                </p>
                <div className="flex flex-wrap gap-2">
                  {PRESET_CUSTOM_RULES.map((preset) => (
                    <button
                      key={preset.tokenPrefix}
                      type="button"
                      onClick={() => handleAddPreset(preset)}
                      className="transition-ui h-8 rounded-md border border-[#eef0f5]/[0.1] bg-[#161b26] px-2.5 text-xs font-medium text-[#eef0f5] hover:border-[#22d3ee]/50"
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
                  placeholder="Rule label"
                  className="h-9 rounded-lg border border-[#eef0f5]/[0.1] bg-[#090b10] px-3 text-xs text-[#eef0f5] placeholder:text-[#7a8296] focus:border-[#22d3ee] focus:outline-none sm:col-span-4"
                />
                <input
                  type="text"
                  aria-label="Custom rule regex pattern"
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  placeholder="RE2 pattern (linear-time O(n))"
                  className="h-9 rounded-lg border border-[#eef0f5]/[0.1] bg-[#090b10] px-3 font-mono text-xs text-[#eef0f5] placeholder:text-[#7a8296] focus:border-[#22d3ee] focus:outline-none sm:col-span-6"
                />
                <button
                  type="button"
                  onClick={handleAddRule}
                  className="transition-ui inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#eef0f5] px-3 text-xs font-medium text-[#090b10] hover:bg-white sm:col-span-2"
                >
                  <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
                  <span>Add</span>
                </button>
              </div>

              {(ruleError || customRuleWarning) && (
                <p role="alert" className="text-xs text-[#e5484d]">
                  {ruleError ?? customRuleWarning}
                </p>
              )}

              {customRules.length === 0 ? (
                <p className="rounded-lg border border-[#eef0f5]/[0.08] bg-[#090b10] p-3 text-xs text-[#7a8296]">
                  No custom rules active yet. Choose a preset above or add a
                  safe regex pattern.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {customRules.map((rule) => (
                    <li
                      key={rule.id}
                      className="flex h-10 items-center justify-between gap-2 rounded-lg border border-[#eef0f5]/[0.08] bg-[#090b10] px-3 text-xs"
                    >
                      <label className="flex min-w-0 cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={() => onToggleCustomRule(rule.id)}
                          className="h-3.5 w-3.5 rounded border-[#eef0f5]/20 bg-[#0f131b] accent-[#22d3ee]"
                        />
                        <span className="font-medium text-[#eef0f5]">
                          {rule.label}
                        </span>
                        <code className="truncate font-mono text-xs text-[#7a8296]">
                          /{rule.pattern}/g
                        </code>
                      </label>
                      <button
                        type="button"
                        onClick={() => onDeleteCustomRule(rule.id)}
                        aria-label={`Remove custom rule ${rule.label}`}
                        className="text-[#7a8296] hover:text-[#e5484d]"
                      >
                        <Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {activeTab === 'vault' && (
            <div
              id="panel-vault"
              role="tabpanel"
              aria-labelledby="tab-vault"
              className="space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-[#a3a9b8]">
                  {mode === 'pseudonym'
                    ? 'Restore pseudonymized tokens locally or export an AES-GCM-256 encrypted mapping file.'
                    : 'Switch Redaction mode above to Pseudonymization to enable local restoration and AES-GCM export.'}
                </p>
                <button
                  type="button"
                  onClick={() => setRestoreInput(result.sanitizedText)}
                  disabled={mode !== 'pseudonym' || !result.sanitizedText}
                  className="transition-ui inline-flex h-8 items-center gap-1.5 rounded-md border border-[#eef0f5]/[0.1] bg-[#161b26] px-3 text-xs font-medium text-[#eef0f5] hover:border-[#22d3ee]/50 disabled:cursor-not-allowed disabled:opacity-40"
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
                  className="custom-scrollbar w-full rounded-lg border border-[#eef0f5]/[0.08] bg-[#090b10] p-3 font-mono text-xs text-[#eef0f5] placeholder:text-[#7a8296] focus:border-[#22d3ee] focus:outline-none"
                />
                <div
                  aria-label="Locally restored output"
                  className="custom-scrollbar h-24 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-[#eef0f5]/[0.08] bg-[#090b10] p-3 font-mono text-xs text-[#eef0f5]"
                >
                  {restoreInput ? (
                    restoredOutput.restoredText
                  ) : (
                    <span className="text-[#7a8296]">
                      Restored text appears here (
                      {restoredOutput.replacementsApplied} tokens restored)
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-[#eef0f5]/[0.08] pt-3">
                <Lock
                  size={16}
                  strokeWidth={1.5}
                  className="text-[#a3a9b8]"
                  aria-hidden="true"
                />
                <input
                  type="password"
                  aria-label="Vault encryption passphrase"
                  value={vaultPassphrase}
                  onChange={(e) => setVaultPassphrase(e.target.value)}
                  placeholder={`Passphrase (min ${MIN_VAULT_PASSPHRASE_LENGTH} chars, mixed)`}
                  className="h-9 min-w-56 rounded-lg border border-[#eef0f5]/[0.1] bg-[#090b10] px-3 text-xs text-[#eef0f5] placeholder:text-[#7a8296] focus:border-[#22d3ee] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleExportEncryptedVault}
                  className="transition-ui inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#eef0f5]/[0.1] bg-[#161b26] px-3 text-xs font-medium text-[#eef0f5] hover:border-[#22d3ee]/50"
                >
                  <Shield size={16} strokeWidth={1.5} aria-hidden="true" />
                  <span>Export AES-GCM key</span>
                </button>
                <span className="font-mono text-xs text-[#7a8296]">
                  PBKDF2-SHA256 ({PBKDF2_ITERATIONS.toLocaleString()} iter) +
                  AES-GCM-256
                </span>
                {vaultStatus && (
                  <span role="status" className="text-xs text-[#22d3ee]">
                    {vaultStatus}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
