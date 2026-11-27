import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  FileJson,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'
import type { OnDeviceAdviceResult } from '../engine/chromeAi'
import { inspectClientNetworkEgress } from '../engine/networkAudit'
import {
  PII_CATEGORY_META,
  type RedactionMode,
  type SanitizeResult,
} from '../engine/types'

interface AuditPanelProps {
  result: SanitizeResult
  mode: RedactionMode
  privacyAdvice: OnDeviceAdviceResult | null
  onDownloadAuditJson: () => void
}

export function AuditPanel({
  result,
  mode,
  privacyAdvice,
  onDownloadAuditJson,
}: AuditPanelProps) {
  const networkAudit = inspectClientNetworkEgress()
  return (
    <section
      aria-labelledby="audit-heading"
      className="grid gap-4 lg:grid-cols-12"
    >
      {/* Left: Metrics & Luhn False Positive Proof */}
      <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5 lg:col-span-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Activity className="h-4 w-4 text-cyan-400" aria-hidden="true" />
            <h2 id="audit-heading" className="text-sm font-semibold text-white">
              Detection Audit &amp; Validation Telemetry
            </h2>
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] text-emerald-300">
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
              <span>
                {networkAudit.externalApiCalls} external API calls
              </span>
            </span>
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

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
            <p className="text-[11px] font-medium text-slate-400">PII Redacted</p>
            <p className="mt-1 font-mono text-xl font-bold text-white">
              {result.totalEntities}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
            <p className="text-[11px] font-medium text-slate-400">
              Luhn Filtered
            </p>
            <p className="mt-1 font-mono text-xl font-bold text-amber-300">
              {result.luhnRejected.length}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
            <p className="text-[11px] font-medium text-slate-400">
              Unique Tokens
            </p>
            <p className="mt-1 font-mono text-xl font-bold text-cyan-300">
              {result.pseudonyms.length}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
            <p className="text-[11px] font-medium text-slate-400">Scan Time</p>
            <p className="mt-1 font-mono text-xl font-bold text-emerald-300">
              {result.processingMs}ms
            </p>
          </div>
        </div>

        {privacyAdvice && (
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
        )}

        {/* Luhn Rejected Candidates List */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
            <span>
              Luhn False-Positive Prevention ({result.luhnRejected.length} ignored)
            </span>
          </div>
          {result.luhnRejected.length === 0 ? (
            <p className="mt-1.5 text-xs text-slate-500">
              No non-Luhn 13–19 digit numeric strings detected in current input.
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

      {/* Right: Pseudonym Consistency Mapping or Entity Breakdown */}
      <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5 lg:col-span-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {mode === 'pseudonym' ? (
              <KeyRound className="h-4 w-4 text-violet-300" aria-hidden="true" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-cyan-300" aria-hidden="true" />
            )}
            <h3 className="text-sm font-semibold text-white">
              {mode === 'pseudonym'
                ? 'Consistent Pseudonym Registry'
                : 'Detected Entity Log'}
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">In-memory only</span>
        </div>

        {result.entities.length === 0 ? (
          <p className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-500">
            No PII entities matched with active filters.
          </p>
        ) : mode === 'pseudonym' ? (
          <div className="custom-scrollbar max-h-60 overflow-auto rounded-xl border border-slate-800 bg-slate-950/60">
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
                      <td className="px-3 py-2 text-slate-300">{meta.shortLabel}</td>
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
          <div className="custom-scrollbar max-h-60 overflow-auto rounded-xl border border-slate-800 bg-slate-950/60">
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
                      <td className="px-3 py-2 font-medium">{meta.shortLabel}</td>
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
    </section>
  )
}
