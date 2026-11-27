import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { OnDeviceAdviceResult } from '../../engine/chromeAi'
import {
  PII_CATEGORY_META,
  type RedactionMode,
  type SanitizeResult,
} from '../../engine/types'

interface AuditPanelProps {
  result: SanitizeResult
  mode: RedactionMode
  privacyAdvice: OnDeviceAdviceResult
}

/**
 * Displays Luhn false-positive filtering diagnostics alongside the live pseudonym
 * registry or detected entity log.
 */
export function AuditPanel({
  result,
  mode,
  privacyAdvice,
}: AuditPanelProps) {
  return (
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
              No non-Luhn 13–19 digit numeric strings detected in current input.
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
                  <th className="px-3 py-2 text-right font-medium">Hits</th>
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
  )
}
