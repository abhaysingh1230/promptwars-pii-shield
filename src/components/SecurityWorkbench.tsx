import { useMemo, useRef, useState } from 'react'
import {
  Activity,
  ChevronDown,
  ChevronRight,
  FileJson,
  FlaskConical,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  Sliders,
} from 'lucide-react'
import type { BenchmarkReport } from '../engine/benchmark'
import type { OnDeviceAdviceResult } from '../engine/chromeAi'
import type { PrivacyRiskAssessment } from '../engine/compliance'
import { inspectClientNetworkEgress } from '../engine/networkAudit'
import type {
  CustomRule,
  RedactionMode,
  SanitizeResult,
} from '../engine/types'
import { handleRovingTabKeyDown } from '../hooks/useRovingTabs'
import { AuditPanel } from './workbench/AuditPanel'
import { BenchmarkPanel } from './workbench/BenchmarkPanel'
import { CustomRulesPanel } from './workbench/CustomRulesPanel'
import { PrivacyStatusPanel } from './workbench/PrivacyStatusPanel'
import { VaultPanel } from './workbench/VaultPanel'

interface SecurityWorkbenchProps {
  result: SanitizeResult
  assessment: PrivacyRiskAssessment
  mode: RedactionMode
  privacyAdvice: OnDeviceAdviceResult
  customRules: CustomRule[]
  customRuleWarning: string | null
  benchmarkReport: BenchmarkReport | null
  onRunBenchmark: () => void
  onAddCustomRule: (rule: CustomRule) => void
  onToggleCustomRule: (id: string) => void
  onDeleteCustomRule: (id: string) => void
  onDownloadPrivacyReceipt: () => void
}

type WorkbenchTab = 'audit' | 'rules' | 'vault' | 'privacy' | 'benchmark'

const TAB_ORDER: readonly WorkbenchTab[] = [
  'audit',
  'rules',
  'vault',
  'privacy',
  'benchmark',
]

/**
 * Secondary workstation accordion hosting audit metrics, RE2 rules, encrypted vault,
 * verifiable browser resource status, and the synthetic accuracy benchmark.
 */
export function SecurityWorkbench({
  result,
  assessment,
  mode,
  privacyAdvice,
  customRules,
  customRuleWarning,
  benchmarkReport,
  onRunBenchmark,
  onAddCustomRule,
  onToggleCustomRule,
  onDeleteCustomRule,
  onDownloadPrivacyReceipt,
}: SecurityWorkbenchProps) {
  const [expanded, setExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<WorkbenchTab>('audit')
  const [auditNonce, setAuditNonce] = useState(0)

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

  function handleOpenTab(tab: WorkbenchTab) {
    setExpanded(true)
    setActiveTab(tab)
    if (tab === 'privacy') setAuditNonce((n) => n + 1)
    else if (tab === 'benchmark') onRunBenchmark()
  }

  const tabs: ReadonlyArray<{
    id: WorkbenchTab
    label: string
    icon: typeof ShieldAlert
  }> = [
    {
      id: 'audit',
      label: `Audit & Luhn (${result.totalEntities})`,
      icon: ShieldAlert,
    },
    { id: 'rules', label: `Custom rules (${customRules.length})`, icon: Sliders },
    { id: 'vault', label: 'Encrypted vault', icon: KeyRound },
    { id: 'privacy', label: 'Privacy status', icon: Activity },
    { id: 'benchmark', label: 'Accuracy benchmark', icon: FlaskConical },
  ]

  const metrics = [
    {
      label: 'Pattern exposure estimate',
      value: `${assessment.rawRiskScore}/100 → 0`,
      sub: `Heuristic (${assessment.severityLabel})`,
    },
    {
      label: 'PII redacted',
      value: String(result.totalEntities),
      sub: `${result.pseudonyms.length} unique tokens`,
    },
    {
      label: 'Luhn filtered',
      value: String(result.luhnRejected.length),
      sub: 'Non-card 16-digit IDs kept',
    },
    {
      label: 'Observed resource timing',
      value: networkAudit.performanceSupported
        ? `${networkAudit.externalCalls} cross-origin`
        : 'Use DevTools',
      sub: `${networkAudit.sameOriginAssetCalls} same-origin · ${assessment.throughputMbPerSec} MB/s`,
    },
  ]

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
            onClick={() => handleOpenTab('privacy')}
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
            onClick={() => handleOpenTab('benchmark')}
            className="transition-ui inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-recessed)] px-2.5 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--border-accent)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-solid)]"
          >
            <FlaskConical
              size={15}
              strokeWidth={1.5}
              className="text-[var(--text-accent)]"
              aria-hidden="true"
            />
            <span>Run privacy benchmark</span>
          </button>

          <button
            type="button"
            onClick={onDownloadPrivacyReceipt}
            disabled={Boolean(result.csvParseError)}
            className="transition-ui inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-panel)] px-2.5 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--border-accent)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-solid)]"
          >
            <FileJson
              size={16}
              strokeWidth={1.5}
              className="text-[var(--text-secondary)]"
              aria-hidden="true"
            />
            <span>Download Privacy Receipt</span>
          </button>
        </div>
      </div>

      {expanded && (
        <div
          id="advanced-security-tools-body"
          className="space-y-4 border-t border-[var(--border-subtle)] p-4"
        >
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {metrics.map((m) => (
              <div
                key={m.label}
                className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-recessed)] p-3"
              >
                <p className="text-xs text-[var(--text-secondary)]">{m.label}</p>
                <p className="mt-1 font-mono text-xl font-medium tabular-nums text-[var(--text-primary)]">
                  {m.value}
                </p>
                <p className="mt-0.5 font-mono text-xs text-[var(--text-muted)]">
                  {m.sub}
                </p>
              </div>
            ))}
          </div>

          <div
            role="tablist"
            aria-label="Advanced security tools sections"
            className="instrument-recessed inline-flex flex-wrap rounded-lg border border-[var(--border-subtle)] p-0.5"
          >
            {tabs.map((tab) => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  ref={(el) => {
                    tabRefs.current[tab.id] = el
                  }}
                  id={`tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={`panel-${tab.id}`}
                  tabIndex={active ? 0 : -1}
                  onClick={() =>
                    tab.id === 'privacy' || tab.id === 'benchmark'
                      ? handleOpenTab(tab.id)
                      : setActiveTab(tab.id)
                  }
                  onKeyDown={(e) =>
                    handleRovingTabKeyDown(
                      e,
                      tab.id,
                      TAB_ORDER,
                      setActiveTab,
                      tabRefs
                    )
                  }
                  className={`transition-ui inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-solid)] ${
                    active
                      ? 'surface-active bg-[var(--bg-active)] text-[var(--text-primary)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>

          {activeTab === 'audit' && (
            <AuditPanel
              result={result}
              mode={mode}
              privacyAdvice={privacyAdvice}
            />
          )}
          {activeTab === 'rules' && (
            <CustomRulesPanel
              customRules={customRules}
              customRuleWarning={customRuleWarning}
              onAddCustomRule={onAddCustomRule}
              onToggleCustomRule={onToggleCustomRule}
              onDeleteCustomRule={onDeleteCustomRule}
            />
          )}
          {activeTab === 'vault' && <VaultPanel result={result} mode={mode} />}
          {activeTab === 'privacy' && (
            <PrivacyStatusPanel
              networkAudit={networkAudit}
              onRecheck={() => setAuditNonce((n) => n + 1)}
            />
          )}
          {activeTab === 'benchmark' && (
            <BenchmarkPanel
              benchmarkReport={benchmarkReport}
              onRunBenchmark={onRunBenchmark}
            />
          )}
        </div>
      )}
    </section>
  )
}
