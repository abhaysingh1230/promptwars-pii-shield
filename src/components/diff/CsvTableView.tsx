import { ShieldCheck } from 'lucide-react'

interface CsvTableViewProps {
  originalRows: string[][]
  sanitizedRows: string[][]
}

/**
 * Renders sanitized CSV data in a labeled table highlighting modified, multiline,
 * and spreadsheet-formula-escaped cells.
 */
export function CsvTableView({
  originalRows,
  sanitizedRows,
}: CsvTableViewProps) {
  return (
    <div className="protected-panel overflow-hidden rounded-xl border border-[var(--border-safe)]">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-protected-header)] px-4 py-2.5 text-xs">
        <div className="flex items-center gap-2 font-medium text-[var(--text-primary)]">
          <ShieldCheck
            size={16}
            strokeWidth={1.5}
            className="text-[var(--text-safe)]"
            aria-hidden="true"
          />
          <span>CSV table view (protected output)</span>
        </div>
        <span className="font-mono text-xs text-[var(--text-muted)]">
          Formula-leading cells escaped on download
        </span>
      </div>

      <div className="custom-scrollbar max-h-72 overflow-auto sm:max-h-80">
        <table className="w-full border-collapse text-left font-mono text-xs tabular-nums">
          <thead className="sticky top-0 z-10 bg-[var(--bg-modal)] text-xs text-[var(--text-secondary)]">
            <tr>
              <th className="border-b border-[var(--border-subtle)] px-3 py-2 font-medium">
                Row
              </th>
              {(sanitizedRows[0] ?? []).map((header, idx) => (
                <th
                  key={idx}
                  className="border-b border-[var(--border-subtle)] px-3 py-2 font-medium text-[var(--text-primary)]"
                >
                  Col {idx + 1}: {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {sanitizedRows.slice(1).map((row, rIdx) => {
              const origRow = originalRows[rIdx + 1] ?? []
              return (
                <tr key={rIdx} className="hover:bg-[var(--bg-table-hover)]">
                  <td className="px-3 py-2 align-top text-[var(--text-muted)]">
                    {rIdx + 1}
                  </td>
                  {row.map((cell, cIdx) => {
                    const origCell = origRow[cIdx] ?? ''
                    const changed = cell !== origCell
                    const isMultiline = cell.includes('\n')
                    const isFormulaEscaped =
                      cell.startsWith("'") && !origCell.startsWith("'")
                    return (
                      <td
                        key={cIdx}
                        className={`whitespace-pre-wrap px-3 py-2 align-top ${
                          changed
                            ? 'bg-[#34d399]/12 text-[var(--text-primary)]'
                            : 'text-[var(--text-secondary)]'
                        }`}
                        title={changed ? `Original: ${origCell}` : 'Unchanged'}
                      >
                        {(isMultiline || isFormulaEscaped) && (
                          <div className="mb-1 flex flex-wrap gap-1">
                            {isMultiline && (
                              <span className="inline-block rounded border border-[var(--border-accent)] bg-[var(--bg-recessed)] px-1.5 py-0.5 text-xs text-[var(--text-accent)]">
                                multiline cell
                              </span>
                            )}
                            {isFormulaEscaped && (
                              <span className="inline-block rounded border border-[#f59e0b]/45 bg-[#f59e0b]/10 px-1.5 py-0.5 text-xs text-[var(--text-warn)]">
                                formula escaped on export
                              </span>
                            )}
                          </div>
                        )}
                        <div>{cell}</div>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
