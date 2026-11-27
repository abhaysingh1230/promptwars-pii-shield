import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileJson,
  FlaskConical,
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
import {
  runSyntheticBenchmark,
  type BenchmarkReport,
} from '../engine/benchmark'
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

type WorkbenchTab = 'audit' | 'rules' | 'vault' | 'privacy' | 'benchmark'

const TAB_ORDER: readonly WorkbenchTab[] = [
  'audit',
  'rules',
  'vault',
  'privacy',
  'benchmark',
]

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
  const [auditNonce, setAuditNonce] = useState(0)
  const [benchmarkReport, setBenchmarkReport] =
    useState<BenchmarkReport | null>(null)

  const tabRefs = useRef<Record<WorkbenchTab, HTMLButtonElement | null>>({
    audit: null,
    rules: null,
    vault: null,
    privacy: null,
    benchmark: null,
  })

  const networkAudit = useMemo(() => {
    void auditNonce
    return inspectClientNetworkEgress()
  }, [auditNonce])

  function handleOpenWorkbenchTab(tab: WorkbenchTab) {
    setExpanded(true)
    setActiveTab(tab)
    if (tab === 'privacy') {
      setAuditNonce((n) => n + 1)
    } else if (tab === 'benchmark') {
      setBenchmarkReport(runSyntheticBenchmark())
    }
  }

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
      className="instrument-panel rounded-xl border border-[var(--border-subtle)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls="advanced-security-tools-body"
          onClick={() => setExpanded((e) => !e)}
          className="transition-ui inline-flex items-center gap-2 text-left font-display text-sm font-medium text-[var(--text-primary)] hover:text-[var(--text-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-solid)]"
        >
          {expanded ? (
            <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" />
          )}
          <span id="advanced-tools-heading">Advanced security tools</span>
          <span className="hidden font-mono text-xs tabular-nums text-[var(--text-muted)] sm:inline">
            · Luhn filtered: {result.luhnRejected.length} · Custom rules:{' '}
            {customRules.length} · AES-GCM vault
          </span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleOpenWorkbenchTab('privacy')}
            className="transition-ui inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-recessed)] px-2.5 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--border-accent)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-solid)]"
          >
            <ShieldCheck
              size={15}
              strokeWidth={1.5}
              className="text-[var(--text-safe)]"
              aria-hidden="true"
            />
            <span>Privacy status</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenWorkbenchTab('benchmark')}
            className="transition-ui inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-recessed)] px-2.5 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--border-accent)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-solid)]"
          >
            <FlaskConical
              size={15}
              strokeWidth={1.5}
              className="text-[var(--text-accent)]"
              aria-hidden="true"
            />
            <span>Run benchmark</span>
          </button>

          <button
            type="button"
            onClick={onDownloadAuditJson}
            disabled={!result.originalText || Boolean(result.csvParseError)}
            className="transition-ui inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-panel)] px-2.5 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--border-accent)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-solid)]"
          >
            <FileJson
              size={16}
              strokeWidth={1.5}
              className="text-[var(--text-secondary)]"
              aria-hidden="true"
            />
            <span>Export audit JSON</span>
          </button>
        </div>
      </div>

      {expanded && (
        <div
          id="advanced-security-tools-body"
          className="space-y-4 border-t border-[var(--border-subtle)] p-4"
        >
          {/* Compact Heuristic Metrics (explicitly scoped, no false guarantees) */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-recessed)] p-3">
              <p className="text-xs text-[var(--text-secondary)]">Pattern exposure estimate</p>
              <p className="mt-1 font-mono text-xl font-medium tabular-nums text-[var(--text-primary)]">
                {assessment.rawRiskScore}/100 → 0
              </p>
              <p className="mt-0.5 font-mono text-xs text-[var(--text-muted)]">
                Heuristic ({assessment.severityLabel})
              </p>
            </div>

            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-recessed)] p-3">
              <p className="text-xs text-[var(--text-secondary)]">PII redacted</p>
              <p className="mt-1 font-mono text-xl font-medium tabular-nums text-[var(--text-primary)]">
                {result.totalEntities}
              </p>
              <p className="mt-0.5 font-mono text-xs text-[var(--text-muted)]">
                {result.pseudonyms.length} unique tokens
              </p>
            </div>

            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-recessed)] p-3">
              <p className="text-xs text-[var(--text-secondary)]">Luhn filtered</p>
              <p className="mt-1 font-mono text-xl font-medium tabular-nums text-[var(--text-primary)]">
                {result.luhnRejected.length}
              </p>
              <p className="mt-0.5 font-mono text-xs text-[var(--text-muted)]">
                Non-card 16-digit IDs kept
              </p>
            </div>

            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-recessed)] p-3">
              <p className="text-xs text-[var(--text-secondary)]">Observed resource timing</p>
              <p className="mt-1 font-mono text-xl font-medium tabular-nums text-[var(--text-primary)]">
                {networkAudit.performanceSupported
                  ? `${networkAudit.externalCalls} cross-origin`
                  : 'Use DevTools'}
              </p>
              <p className="mt-0.5 font-mono text-xs text-[var(--text-muted)]">
                {networkAudit.sameOriginAssetCalls} same-origin ·{' '}
                {assessment.throughputMbPerSec} MB/s
              </p>
            </div>
          </div>

          {/* Keyboard-Operable Tabs */}
          <div
            role="tablist"
            aria-label="Advanced security tools sections"
            className="instrument-recessed inline-flex flex-wrap rounded-lg border border-[var(--border-subtle)] p-0.5"
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
              className={`transition-ui inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-solid)] ${
                activeTab === 'audit'
                  ? 'surface-active bg-[var(--bg-active)] text-[var(--text-primary)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
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
              className={`transition-ui inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-solid)] ${
                activeTab === 'rules'
                  ? 'surface-active bg-[var(--bg-active)] text-[var(--text-primary)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
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
              className={`transition-ui inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-solid)] ${
                activeTab === 'vault'
                  ? 'surface-active bg-[var(--bg-active)] text-[var(--text-primary)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <KeyRound size={16} strokeWidth={1.5} aria-hidden="true" />
              <span>Encrypted vault</span>
            </button>
            <button
              ref={(el) => {
                tabRefs.current.privacy = el
              }}
              id="tab-privacy"
              type="button"
              role="tab"
              aria-selected={activeTab === 'privacy'}
              aria-controls="panel-privacy"
              tabIndex={activeTab === 'privacy' ? 0 : -1}
              onClick={() => handleOpenWorkbenchTab('privacy')}
              onKeyDown={(e) => handleTabKeyDown(e, 'privacy')}
              className={`transition-ui inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-solid)] ${
                activeTab === 'privacy'
                  ? 'surface-active bg-[var(--bg-active)] text-[var(--text-primary)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Activity size={16} strokeWidth={1.5} aria-hidden="true" />
              <span>Privacy status</span>
            </button>
            <button
              ref={(el) => {
                tabRefs.current.benchmark = el
              }}
              id="tab-benchmark"
              type="button"
              role="tab"
              aria-selected={activeTab === 'benchmark'}
              aria-controls="panel-benchmark"
              tabIndex={activeTab === 'benchmark' ? 0 : -1}
              onClick={() => handleOpenWorkbenchTab('benchmark')}
              onKeyDown={(e) => handleTabKeyDown(e, 'benchmark')}
              className={`transition-ui inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-solid)] ${
                activeTab === 'benchmark'
                  ? 'surface-active bg-[var(--bg-active)] text-[var(--text-primary)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <FlaskConical size={16} strokeWidth={1.5} aria-hidden="true" />
              <span>Accuracy benchmark</span>
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
                <div className="flex items-start gap-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-recessed)] p-3 text-xs text-[var(--text-secondary)]">
                  <CheckCircle2
                    size={16}
                    strokeWidth={1.5}
                    className="mt-0.5 shrink-0 text-[var(--text-safe)]"
                    aria-hidden="true"
                  />
                  <div>
                    <span className="font-medium text-[var(--text-primary)]">
                      {privacyAdvice.source === 'gemini-nano'
                        ? 'On-device Gemini Nano note: '
                        : 'Local summary: '}
                    </span>
                    <span>{privacyAdvice.summary}</span>
                  </div>
                </div>

                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-recessed)] p-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-primary)]">
                    <AlertTriangle
                      size={16}
                      strokeWidth={1.5}
                      className="text-[var(--text-secondary)]"
                      aria-hidden="true"
                    />
                    <span>
                      Luhn false-positive prevention ({result.luhnRejected.length}{' '}
                      ignored)
                    </span>
                  </div>
                  {result.luhnRejected.length === 0 ? (
                    <p className="mt-1.5 text-xs text-[var(--text-muted)]">
                      No non-Luhn 13–19 digit numeric strings detected in current
                      input.
                    </p>
                  ) : (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {result.luhnRejected.map((item, idx) => (
                        <li
                          key={`${item.digits}-${idx}`}
                          className="inline-flex items-center gap-1.5 rounded border border-[var(--border-strong)] bg-[var(--bg-panel)] px-2.5 py-1 font-mono text-xs text-[var(--text-primary)]"
                          title={item.reason}
                        >
                          <span>{item.raw}</span>
                          <span className="text-[var(--text-muted)]">kept safe</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="min-w-0 space-y-2 lg:col-span-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-medium text-[var(--text-secondary)]">
                    {mode === 'pseudonym'
                      ? 'Consistent pseudonym registry'
                      : 'Detected entity log'}
                  </h3>
                  <span className="text-xs text-[var(--text-muted)]">In-memory only</span>
                </div>

                {result.entities.length === 0 ? (
                  <p className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-recessed)] p-4 text-xs text-[var(--text-muted)]">
                    No PII entities matched with active filters.
                  </p>
                ) : mode === 'pseudonym' ? (
                  <div className="custom-scrollbar max-h-48 max-w-full overflow-x-auto overflow-y-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-recessed)]">
                    <table className="w-full text-left text-xs tabular-nums">
                      <thead className="sticky top-0 bg-[var(--bg-modal)] text-xs text-[var(--text-secondary)]">
                        <tr>
                          <th className="px-3 py-2 font-medium">Token</th>
                          <th className="px-3 py-2 font-medium">Category</th>
                          <th className="px-3 py-2 font-medium">Masked ref</th>
                          <th className="px-3 py-2 text-right font-medium">
                            Hits
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-subtle)]">
                        {result.pseudonyms.map((m) => {
                          const meta = PII_CATEGORY_META[m.category]
                          return (
                            <tr key={m.pseudonym} className="text-[var(--text-primary)]">
                              <td className="px-3 py-2 font-mono text-[var(--text-accent)]">
                                {m.pseudonym}
                              </td>
                              <td className="px-3 py-2 text-[var(--text-secondary)]">
                                {meta.shortLabel}
                              </td>
                              <td className="px-3 py-2 font-mono text-[var(--text-muted)]">
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
                  <div className="custom-scrollbar max-h-48 max-w-full overflow-x-auto overflow-y-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-recessed)]">
                    <table className="w-full text-left text-xs tabular-nums">
                      <thead className="sticky top-0 bg-[var(--bg-modal)] text-xs text-[var(--text-secondary)]">
                        <tr>
                          <th className="px-3 py-2 font-medium">Type</th>
                          <th className="px-3 py-2 font-medium">Output token</th>
                          <th className="px-3 py-2 font-medium">Validation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-subtle)]">
                        {result.entities.slice(0, 60).map((ent) => {
                          const meta = PII_CATEGORY_META[ent.category]
                          return (
                            <tr key={ent.id} className="text-[var(--text-primary)]">
                              <td className="px-3 py-2 font-medium">
                                {meta.shortLabel}
                              </td>
                              <td className="px-3 py-2 font-mono text-[var(--text-accent)]">
                                {ent.replacement}
                              </td>
                              <td className="px-3 py-2 text-[var(--text-muted)]">
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
                <p className="text-xs text-[var(--text-secondary)]">
                  Custom rules compile with Google&apos;s RE2 linear-time engine
                  (re2js) inside a Web Worker with an 800 ms watchdog.
                </p>
                <div className="flex flex-wrap gap-2">
                  {PRESET_CUSTOM_RULES.map((preset) => (
                    <button
                      key={preset.tokenPrefix}
                      type="button"
                      onClick={() => handleAddPreset(preset)}
                      className="transition-ui h-8 rounded-md border border-[var(--border-strong)] bg-[var(--bg-panel)] px-2.5 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--border-accent)]"
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
                  className="h-9 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-recessed)] px-3 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-solid)] focus:outline-none sm:col-span-4"
                />
                <input
                  type="text"
                  aria-label="Custom rule regex pattern"
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  placeholder="RE2 pattern (linear-time O(n))"
                  className="h-9 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-recessed)] px-3 font-mono text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-solid)] focus:outline-none sm:col-span-6"
                />
                <button
                  type="button"
                  onClick={handleAddRule}
                  className="transition-ui inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[var(--cta-solid)] px-3 text-xs font-medium text-[var(--cta-solid-text)] hover:bg-[var(--cta-solid-hover)] sm:col-span-2"
                >
                  <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
                  <span>Add</span>
                </button>
              </div>

              {(ruleError || customRuleWarning) && (
                <p role="alert" className="text-xs text-[var(--text-danger)]">
                  {ruleError ?? customRuleWarning}
                </p>
              )}

              {customRules.length === 0 ? (
                <p className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-recessed)] p-3 text-xs text-[var(--text-muted)]">
                  No custom rules active yet. Choose a preset above or add a
                  safe regex pattern.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {customRules.map((rule) => (
                    <li
                      key={rule.id}
                      className="flex h-10 items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-recessed)] px-3 text-xs"
                    >
                      <label className="flex min-w-0 cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={() => onToggleCustomRule(rule.id)}
                          className="h-3.5 w-3.5 rounded border-[var(--border-strong)] bg-[var(--bg-modal)] accent-[var(--accent-solid)]"
                        />
                        <span className="font-medium text-[var(--text-primary)]">
                          {rule.label}
                        </span>
                        <code className="truncate font-mono text-xs text-[var(--text-muted)]">
                          /{rule.pattern}/g
                        </code>
                      </label>
                      <button
                        type="button"
                        onClick={() => onDeleteCustomRule(rule.id)}
                        aria-label={`Remove custom rule ${rule.label}`}
                        className="text-[var(--text-muted)] hover:text-[var(--text-danger)]"
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
                      Restored text appears here (
                      {restoredOutput.replacementsApplied} tokens restored)
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
                  PBKDF2-SHA256 ({PBKDF2_ITERATIONS.toLocaleString()} iter) +
                  AES-GCM-256
                </span>
                {vaultStatus && (
                  <span role="status" className="text-xs text-[var(--text-accent)]">
                    {vaultStatus}
                  </span>
                )}
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div
              id="panel-privacy"
              role="tabpanel"
              aria-labelledby="tab-privacy"
              className="grid gap-4 lg:grid-cols-12"
            >
              <div className="space-y-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-recessed)] p-3.5 text-xs lg:col-span-6">
                <div className="flex items-center gap-2 font-display font-medium text-[var(--text-primary)]">
                  <ShieldCheck
                    size={16}
                    strokeWidth={1.5}
                    className="text-[var(--text-safe)]"
                    aria-hidden="true"
                  />
                  <span>What is processed locally in this browser</span>
                </div>
                <ul className="list-disc space-y-1.5 pl-4 text-[var(--text-secondary)]">
                  <li>
                    <span className="text-[var(--text-primary)]">Detection &amp; redaction:</span>{' '}
                    Regex matching, overlap resolution, Luhn mod-10, and Verhoeff
                    Aadhaar checksum checks run in browser memory.
                  </li>
                  <li>
                    <span className="text-[var(--text-primary)]">Phone &amp; RE2 engines:</span>{' '}
                    Numbering plans (<span className="font-mono">libphonenumber-js/max</span>)
                    and linear-time custom RE2 rules (<span className="font-mono">re2js</span>)
                    are bundled locally with Web Worker isolation.
                  </li>
                  <li>
                    <span className="text-[var(--text-primary)]">CSV, Vault &amp; Fonts:</span>{' '}
                    Strict quote parsing, formula-prefix escaping, PBKDF2 + AES-GCM
                    encryption, and Space Grotesk fonts operate without remote CDNs.
                  </li>
                  <li>
                    <span className="text-[var(--text-primary)]">Storage behavior:</span>{' '}
                    Raw text and PII are never persisted to cookies, IndexedDB,
                    or <span className="font-mono">localStorage</span> (only UI theme
                    preference <span className="font-mono">pii-shield-theme</span> is saved).
                  </li>
                </ul>
              </div>

              <div className="space-y-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-recessed)] p-3.5 text-xs lg:col-span-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-display font-medium text-[var(--text-primary)]">
                    <Activity
                      size={16}
                      strokeWidth={1.5}
                      className="text-[var(--text-accent)]"
                      aria-hidden="true"
                    />
                    <span>Browser-observable resource check</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAuditNonce((n) => n + 1)}
                    className="transition-ui inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--border-strong)] bg-[var(--bg-panel)] px-2.5 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--border-accent)]"
                  >
                    <RefreshCw size={13} strokeWidth={1.5} aria-hidden="true" />
                    <span>Re-check</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 font-mono tabular-nums">
                  <div className="rounded border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-2.5">
                    <div className="text-[11px] text-[var(--text-muted)]">
                      Same-origin resources
                    </div>
                    <div className="mt-0.5 text-base font-medium text-[var(--text-primary)]">
                      {networkAudit.sameOriginAssetCalls}
                    </div>
                  </div>
                  <div className="rounded border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-2.5">
                    <div className="text-[11px] text-[var(--text-muted)]">
                      Cross-origin resources
                    </div>
                    <div
                      className={`mt-0.5 text-base font-medium ${
                        networkAudit.externalCalls === 0
                          ? 'text-[var(--text-safe)]'
                          : 'text-[var(--text-danger)]'
                      }`}
                    >
                      {networkAudit.externalCalls}
                    </div>
                  </div>
                </div>

                <p className="text-[var(--text-secondary)]">
                  {networkAudit.auditNote}
                </p>

                {networkAudit.observedOrigins.length > 0 && (
                  <p className="font-mono text-[11px] text-[var(--text-muted)]">
                    Observed origin(s): {networkAudit.observedOrigins.join(', ')}
                  </p>
                )}

                <p className="border-t border-[var(--border-subtle)] pt-2 text-[11px] text-[var(--text-muted)]">
                  Scope note: Only resources exposed to this tab&apos;s{' '}
                  <span className="font-mono">performance.getEntriesByType(&apos;resource&apos;)</span>{' '}
                  API are shown here. For full network verification, inspect
                  browser DevTools → Network.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'benchmark' && (
            <div
              id="panel-benchmark"
              role="tabpanel"
              aria-labelledby="tab-benchmark"
              className="space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-xs font-medium text-[var(--text-primary)]">
                    Reproducible synthetic accuracy benchmark (100% synthetic test corpus)
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Verifies built-in detectors, Luhn 13–19 digits, overlaps,
                    mixed-case PAN, Unicode boundaries, RFC IPv6, phones, strict
                    CSV, formula escaping, and cross-row pseudonyms locally.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setBenchmarkReport(runSyntheticBenchmark())}
                  className="transition-ui inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--accent-solid)] px-3 text-xs font-medium text-[var(--accent-solid-text)] hover:bg-[var(--accent-solid-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-solid)]"
                >
                  <FlaskConical size={15} strokeWidth={1.5} aria-hidden="true" />
                  <span>
                    {benchmarkReport
                      ? 'Re-run synthetic benchmark'
                      : 'Run synthetic benchmark'}
                  </span>
                </button>
              </div>

              {benchmarkReport ? (
                <>
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-recessed)] p-3">
                      <p className="text-xs text-[var(--text-secondary)]">
                        Synthetic cases passed
                      </p>
                      <p className="mt-1 font-mono text-lg font-medium tabular-nums text-[var(--text-safe)]">
                        {benchmarkReport.passedCases}/{benchmarkReport.totalCases}{' '}
                        <span className="text-xs text-[var(--text-muted)]">
                          ({benchmarkReport.failedCases} failed)
                        </span>
                      </p>
                    </div>
                    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-recessed)] p-3">
                      <p className="text-xs text-[var(--text-secondary)]">
                        False positives
                      </p>
                      <p className="mt-1 font-mono text-lg font-medium tabular-nums text-[var(--text-primary)]">
                        {benchmarkReport.falsePositives}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-recessed)] p-3">
                      <p className="text-xs text-[var(--text-secondary)]">
                        False negatives
                      </p>
                      <p className="mt-1 font-mono text-lg font-medium tabular-nums text-[var(--text-primary)]">
                        {benchmarkReport.falseNegatives}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-recessed)] p-3">
                      <p className="text-xs text-[var(--text-secondary)]">
                        Total runtime
                      </p>
                      <p className="mt-1 font-mono text-lg font-medium tabular-nums text-[var(--text-accent)]">
                        {benchmarkReport.durationMs} ms
                      </p>
                    </div>
                  </div>

                  <div className="custom-scrollbar max-h-64 overflow-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-recessed)]">
                    <table className="w-full text-left text-xs tabular-nums">
                      <thead className="sticky top-0 bg-[var(--bg-modal)] text-xs text-[var(--text-secondary)]">
                        <tr>
                          <th className="px-3 py-2 font-medium">Suite</th>
                          <th className="px-3 py-2 font-medium">Synthetic check</th>
                          <th className="px-3 py-2 font-medium">Result</th>
                          <th className="px-3 py-2 font-medium">FP / FN</th>
                          <th className="px-3 py-2 text-right font-medium">Time</th>
                          <th className="px-3 py-2 text-right font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-subtle)]">
                        {benchmarkReport.cases.map((c) => (
                          <tr key={c.id} className="text-[var(--text-primary)]">
                            <td className="px-3 py-2 font-medium">
                              {c.categoryGroup}
                            </td>
                            <td className="px-3 py-2 text-[var(--text-secondary)]">
                              {c.scenario}
                            </td>
                            <td className="px-3 py-2 text-[var(--text-secondary)]">
                              {c.detail}
                            </td>
                            <td className="px-3 py-2 font-mono text-[var(--text-muted)]">
                              {c.falsePositives} / {c.falseNegatives}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-[var(--text-muted)]">
                              {c.durationMs} ms
                            </td>
                            <td className="px-3 py-2 text-right font-mono">
                              <span
                                className={`rounded border px-1.5 py-0.5 text-[11px] ${
                                  c.passed
                                    ? 'border-[var(--border-safe)] bg-[var(--bg-protected-well)] text-[var(--text-safe)]'
                                    : 'border-[#e5484d]/50 bg-[#e5484d]/10 text-[var(--text-danger)]'
                                }`}
                              >
                                {c.passed ? 'PASS' : 'FAIL'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-recessed)] p-3 text-xs text-[var(--text-muted)]">
                  Click &ldquo;Run synthetic benchmark&rdquo; to execute all 9
                  deterministic synthetic accuracy checks locally in this tab.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
