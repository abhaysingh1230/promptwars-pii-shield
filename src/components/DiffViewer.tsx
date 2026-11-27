import { useMemo, useRef, useState } from 'react'
import {
  Check,
  Copy,
  Download,
  Eye,
  FileCode2,
  Info,
  Link2,
  Table2,
} from 'lucide-react'
import { parseCsv } from '../engine/csv'
import {
  PII_CATEGORY_META,
  type DiffSegment,
  type PiiEntity,
  type SanitizeResult,
} from '../engine/types'

interface DiffViewerProps {
  rawInput: string
  onRawInputChange: (value: string) => void
  result: SanitizeResult
  downloadFileName: string
  onDownloadSanitized: () => void
}

function renderHighlightedSegments(
  segments: DiffSegment[],
  variant: 'original' | 'sanitized',
  selectedId: string | null,
  onSelectEntity: (entity: PiiEntity) => void
) {
  if (segments.length === 0) {
    return (
      <span className="text-slate-500">
        Paste text above or load a sample dataset to inspect live PII highlights...
      </span>
    )
  }

  return segments.map((seg, idx) => {
    if (seg.type === 'text' || !seg.entity) {
      return <span key={idx}>{seg.text}</span>
    }

    const entity = seg.entity
    const meta = PII_CATEGORY_META[entity.category]
    const isSelected = selectedId === entity.id
    const tooltip = [
      meta.label,
      entity.validationNote ? `(${entity.validationNote})` : '',
      variant === 'original' ? `→ ${entity.replacement}` : `← redacted`,
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <button
        key={`${entity.id}-${idx}`}
        type="button"
        onClick={() => onSelectEntity(entity)}
        title={tooltip}
        aria-label={tooltip}
        className={`inline cursor-pointer rounded px-1 py-0.5 font-mono text-[13px] transition ${
          variant === 'original' ? meta.highlightClass : meta.redactedClass
        } ${isSelected ? 'ring-2 ring-white/90' : ''}`}
      >
        {seg.text}
      </button>
    )
  })
}

export function DiffViewer({
  rawInput,
  onRawInputChange,
  result,
  downloadFileName,
  onDownloadSanitized,
}: DiffViewerProps) {
  const [copied, setCopied] = useState(false)
  const [leftTab, setLeftTab] = useState<'edit' | 'highlights'>('edit')
  const [viewMode, setViewMode] = useState<'text' | 'table'>('text')
  const [syncScroll, setSyncScroll] = useState(true)
  const [selectedEntity, setSelectedEntity] = useState<PiiEntity | null>(null)

  const leftScrollRef = useRef<HTMLDivElement>(null)
  const rightScrollRef = useRef<HTMLDivElement>(null)
  const isSyncingRef = useRef(false)

  const csvTables = useMemo(() => {
    if (!result.isCsv) return null
    return {
      originalRows: parseCsv(result.originalText),
      sanitizedRows: parseCsv(result.sanitizedText),
    }
  }, [result.isCsv, result.originalText, result.sanitizedText])

  const effectiveViewMode = result.isCsv ? viewMode : 'text'

  function handleSyncScroll(source: 'left' | 'right') {
    if (!syncScroll || isSyncingRef.current) return
    const srcEl =
      source === 'left' ? leftScrollRef.current : rightScrollRef.current
    const dstEl =
      source === 'left' ? rightScrollRef.current : leftScrollRef.current
    if (!srcEl || !dstEl) return

    isSyncingRef.current = true
    dstEl.scrollTop = srcEl.scrollTop
    requestAnimationFrame(() => {
      isSyncingRef.current = false
    })
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(result.sanitizedText)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard may be unavailable in restricted test environments
    }
  }

  return (
    <section aria-labelledby="diff-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="diff-heading" className="text-sm font-semibold text-white">
            Live Side-by-Side Diff View
          </h2>
          {result.isCsv && (
            <span className="rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 font-mono text-[11px] text-blue-300">
              CSV Mode • {result.csvRowCount} rows × {result.csvColCount} cols
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {result.isCsv && (
            <div
              role="group"
              aria-label="CSV view format"
              className="inline-flex rounded-lg border border-slate-800 bg-slate-900 p-0.5"
            >
              <button
                type="button"
                aria-pressed={effectiveViewMode === 'text'}
                onClick={() => setViewMode('text')}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  effectiveViewMode === 'text'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileCode2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Raw Diff</span>
              </button>
              <button
                type="button"
                aria-pressed={effectiveViewMode === 'table'}
                onClick={() => setViewMode('table')}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  effectiveViewMode === 'table'
                    ? 'bg-cyan-500/20 text-cyan-200'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Table2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Table Diff</span>
              </button>
            </div>
          )}

          <button
            type="button"
            aria-pressed={syncScroll}
            onClick={() => setSyncScroll((s) => !s)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
              syncScroll
                ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200'
                : 'border-slate-700 bg-slate-900 text-slate-400'
            }`}
            title="Synchronize scrolling between original and sanitized panes"
          >
            <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Sync Scroll</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            disabled={!result.sanitizedText}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                <span className="text-emerald-300">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                <span>Copy Output</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onDownloadSanitized}
            disabled={!result.sanitizedText}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Download {downloadFileName}</span>
          </button>
        </div>
      </div>

      {/* Interactive Click-to-Inspect Banner */}
      {selectedEntity && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cyan-500/35 bg-cyan-950/30 px-3.5 py-2 text-xs"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Info className="h-4 w-4 text-cyan-300" aria-hidden="true" />
            <span className="font-semibold text-white">
              {PII_CATEGORY_META[selectedEntity.category].label}
            </span>
            {selectedEntity.validationNote && (
              <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-[11px] text-emerald-300">
                {selectedEntity.validationNote}
              </span>
            )}
            <span className="text-slate-400">Output Token:</span>
            <code className="rounded bg-slate-900 px-2 py-0.5 font-mono text-cyan-300">
              {selectedEntity.replacement}
            </code>
          </div>
          <button
            type="button"
            onClick={() => setSelectedEntity(null)}
            className="text-xs text-slate-400 underline hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {effectiveViewMode === 'table' && csvTables ? (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
          <div className="border-b border-slate-800 bg-slate-950/60 px-4 py-2.5 text-xs font-semibold text-slate-200">
            Side-by-Side CSV Cell Diff (Original → Sanitized)
          </div>
          <div className="custom-scrollbar max-h-96 overflow-auto">
            <table className="w-full border-collapse text-left font-mono text-xs">
              <thead className="sticky top-0 z-10 bg-slate-950 text-[11px] text-slate-400">
                <tr>
                  <th className="border-b border-slate-800 px-3 py-2">#</th>
                  {(csvTables.sanitizedRows[0] ?? []).map((header, idx) => (
                    <th
                      key={idx}
                      className="border-b border-slate-800 px-3 py-2 font-semibold text-slate-200"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {csvTables.sanitizedRows.slice(1).map((row, rIdx) => {
                  const origRow = csvTables.originalRows[rIdx + 1] ?? []
                  return (
                    <tr key={rIdx} className="hover:bg-slate-800/40">
                      <td className="px-3 py-2 text-slate-500">{rIdx + 1}</td>
                      {row.map((cell, cIdx) => {
                        const origCell = origRow[cIdx] ?? ''
                        const changed = cell !== origCell
                        return (
                          <td
                            key={cIdx}
                            className={`px-3 py-2 ${
                              changed
                                ? 'bg-emerald-500/10 text-emerald-200'
                                : 'text-slate-300'
                            }`}
                            title={
                              changed ? `Original: ${origCell}` : 'Unchanged'
                            }
                          >
                            {cell}
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
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Left Pane: Original Input / Annotated Highlights */}
          <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-4 py-2.5">
              <label
                htmlFor="raw-pii-input"
                className="text-xs font-semibold text-slate-200"
              >
                Original Input
              </label>
              <div
                role="tablist"
                aria-label="Original input view mode"
                className="inline-flex rounded-lg border border-slate-800 bg-slate-900 p-0.5"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={leftTab === 'edit'}
                  onClick={() => setLeftTab('edit')}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                    leftTab === 'edit'
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <FileCode2 className="h-3 w-3" aria-hidden="true" />
                  <span>Edit Text</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={leftTab === 'highlights'}
                  onClick={() => setLeftTab('highlights')}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                    leftTab === 'highlights'
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Eye className="h-3 w-3" aria-hidden="true" />
                  <span>PII Highlights ({result.totalEntities})</span>
                </button>
              </div>
            </div>

            {leftTab === 'edit' ? (
              <textarea
                id="raw-pii-input"
                value={rawInput}
                onChange={(e) => onRawInputChange(e.target.value)}
                placeholder="Paste raw logs, resumes, support tickets, clinical notes, or CSV rows here — everything stays 100% in your browser..."
                spellCheck={false}
                className="custom-scrollbar h-80 w-full resize-y bg-transparent p-4 font-mono text-[13px] leading-relaxed text-slate-100 placeholder:text-slate-500 focus:outline-none sm:h-96"
              />
            ) : (
              <div
                ref={leftScrollRef}
                onScroll={() => handleSyncScroll('left')}
                aria-label="Original text with detected PII highlighted"
                className="custom-scrollbar h-80 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-[13px] leading-relaxed text-slate-200 sm:h-96"
              >
                {renderHighlightedSegments(
                  result.originalSegments,
                  'original',
                  selectedEntity?.id ?? null,
                  setSelectedEntity
                )}
              </div>
            )}
          </div>

          {/* Right Pane: Sanitized Diff Output */}
          <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-4 py-2.5">
              <span className="text-xs font-semibold text-emerald-300">
                Sanitized Output (Click any badge to inspect)
              </span>
              <span
                aria-live="polite"
                className="font-mono text-[11px] text-slate-400"
              >
                {result.totalEntities} redacted in {result.processingMs} ms
              </span>
            </div>

            <div
              ref={rightScrollRef}
              onScroll={() => handleSyncScroll('right')}
              aria-label="Sanitized output diff preview"
              className="custom-scrollbar h-80 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-[13px] leading-relaxed text-slate-100 sm:h-96"
            >
              {renderHighlightedSegments(
                result.sanitizedSegments,
                'sanitized',
                selectedEntity?.id ?? null,
                setSelectedEntity
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
