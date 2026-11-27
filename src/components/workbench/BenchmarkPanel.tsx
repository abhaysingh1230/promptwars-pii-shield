import { useState } from 'react'
import { FlaskConical } from 'lucide-react'
import type { BenchmarkReport } from '../../engine/benchmark'

interface BenchmarkPanelProps {
  benchmarkReport: BenchmarkReport | null
  onRunBenchmark: () => void
}

/**
 * Renders the reproducible 10-case synthetic accuracy benchmark and per-case inspector.
 */
export function BenchmarkPanel({
  benchmarkReport,
  onRunBenchmark,
}: BenchmarkPanelProps) {
  const [inspectedCaseId, setInspectedCaseId] = useState<string | null>(null)

  const activeCase = benchmarkReport
    ? (benchmarkReport.cases.find((c) => c.id === inspectedCaseId) ??
      benchmarkReport.cases.find((c) => !c.passed) ??
      null)
    : null

  return (
    <div
      id="panel-benchmark"
      role="tabpanel"
      aria-labelledby="tab-benchmark"
      className="space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-xs font-medium text-[var(--text-primary)]">
            Privacy benchmark v2026.1 (100% synthetic test corpus)
          </h3>
          <p className="text-xs text-[var(--text-secondary)]">
            Synthetic regression checks only — results verify known edge cases
            and do not prove perfect detection on arbitrary real-world text.
            Select any suite name to inspect expected vs. actual output.
          </p>
        </div>
        <button
          type="button"
          onClick={onRunBenchmark}
          className="transition-ui inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--accent-solid)] px-3 text-xs font-medium text-[var(--accent-solid-text)] hover:bg-[var(--accent-solid-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-solid)]"
        >
          <FlaskConical size={15} strokeWidth={1.5} aria-hidden="true" />
          <span>
            {benchmarkReport
              ? 'Re-run privacy benchmark'
              : 'Run privacy benchmark'}
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
                {benchmarkReport.cases.map((c) => {
                  const isInspected = activeCase?.id === c.id
                  return (
                    <tr
                      key={c.id}
                      className={`transition-ui text-[var(--text-primary)] hover:bg-[var(--bg-table-hover)] ${
                        isInspected ? 'bg-[var(--bg-active)]/50' : ''
                      }`}
                    >
                      <td className="px-3 py-2 font-medium">
                        <button
                          type="button"
                          aria-expanded={isInspected}
                          onClick={() =>
                            setInspectedCaseId(isInspected ? null : c.id)
                          }
                          className="text-left hover:text-[var(--text-accent)] focus-visible:outline-none focus-visible:underline"
                        >
                          {c.categoryGroup}
                        </button>
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
                  )
                })}
              </tbody>
            </table>
          </div>

          {activeCase && (
            <div
              role="region"
              aria-label={`Benchmark case details for ${activeCase.categoryGroup}`}
              className="rounded-lg border border-[var(--border-accent)] bg-[var(--bg-recessed)] p-3 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-display font-medium text-[var(--text-primary)]">
                  Case inspection: {activeCase.categoryGroup} (
                  {activeCase.passed ? 'PASS' : 'FAIL'})
                </span>
                <button
                  type="button"
                  onClick={() => setInspectedCaseId(null)}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  Close
                </button>
              </div>
              <dl className="mt-2 grid gap-1.5 text-[var(--text-secondary)]">
                <div>
                  <dt className="inline font-medium text-[var(--text-primary)]">
                    Synthetic input:{' '}
                  </dt>
                  <dd className="inline">{activeCase.inputSummary}</dd>
                </div>
                <div>
                  <dt className="inline font-medium text-[var(--text-primary)]">
                    Expected:{' '}
                  </dt>
                  <dd className="inline">{activeCase.expectedBehavior}</dd>
                </div>
                <div>
                  <dt className="inline font-medium text-[var(--text-primary)]">
                    Actual:{' '}
                  </dt>
                  <dd className="inline font-mono text-[var(--text-accent)]">
                    {activeCase.actualOutput}
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </>
      ) : (
        <p className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-recessed)] p-3 text-xs text-[var(--text-muted)]">
          Click &ldquo;Run privacy benchmark&rdquo; to execute all 10
          deterministic synthetic accuracy checks locally in this tab.
        </p>
      )}
    </div>
  )
}
