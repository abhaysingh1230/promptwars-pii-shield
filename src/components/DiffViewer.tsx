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
      <span className="text-[#7a8296]">
        Paste text or load a sample dataset to inspect live PII highlights
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
        className={`transition-unslop inline cursor-pointer rounded px-1 py-0.5 font-mono text-[13px] ${
          variant === 'original' ? meta.highlightClass : meta.redactedClass
        } ${isSelected ? 'ring-1 ring-[#eef0f5]' : ''}`}
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
  const lineCount = rawInput ? rawInput.split(/\r\n|\r|\n/).length : 0

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
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="diff-heading" className="text-sm font-medium text-[#eef0f5]">
            Side-by-side diff
          </h2>
          {result.isCsv && (
            <span className="font-mono text-xs tabular-nums text-[#a3a9b8]">
              CSV · {result.csvRowCount} rows × {result.csvColCount} cols
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {result.isCsv && (
            <div
              role="group"
              aria-label="CSV view format"
              className="inline-flex rounded-lg border border-[#eef0f5]/[0.08] bg-[#11141c] p-0.5"
            >
              <button
                type="button"
                aria-pressed={effectiveViewMode === 'text'}
                onClick={() => setViewMode('text')}
                className={`transition-unslop inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium ${
                  effectiveViewMode === 'text'
                    ? 'surface-active bg-[#1a1e28] text-[#eef0f5]'
                    : 'text-[#a3a9b8] hover:text-[#eef0f5]'
                }`}
              >
                <FileCode2 size={16} strokeWidth={1.5} aria-hidden="true" />
                <span>Raw diff</span>
              </button>
              <button
                type="button"
                aria-pressed={effectiveViewMode === 'table'}
                onClick={() => setViewMode('table')}
                className={`transition-unslop inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium ${
                  effectiveViewMode === 'table'
                    ? 'surface-active bg-[#1a1e28] text-[#eef0f5]'
                    : 'text-[#a3a9b8] hover:text-[#eef0f5]'
                }`}
              >
                <Table2 size={16} strokeWidth={1.5} aria-hidden="true" />
                <span>Table diff</span>
              </button>
            </div>
          )}

          <button
            type="button"
            aria-pressed={syncScroll}
            onClick={() => setSyncScroll((s) => !s)}
            className={`transition-unslop inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8] ${
              syncScroll
                ? 'surface-active border-[#38bdf8]/40 bg-[#1a1e28] text-[#eef0f5]'
                : 'border-[#eef0f5]/[0.08] bg-[#11141c] text-[#a3a9b8] hover:text-[#eef0f5]'
            }`}
            title="Synchronize scrolling between original and sanitized panes"
          >
            <Link2 size={16} strokeWidth={1.5} aria-hidden="true" />
            <span>Sync scroll</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            disabled={!result.sanitizedText}
            className="transition-unslop inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#eef0f5]/[0.08] bg-[#1a1e28] px-3 text-xs font-medium text-[#eef0f5] hover:border-[#eef0f5]/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8]"
          >
            {copied ? (
              <>
                <Check
                  size={16}
                  strokeWidth={1.5}
                  className="text-[#4cc38a]"
                  aria-hidden="true"
                />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy
                  size={16}
                  strokeWidth={1.5}
                  className="text-[#a3a9b8]"
                  aria-hidden="true"
                />
                <span>Copy output</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onDownloadSanitized}
            disabled={!result.sanitizedText}
            className="transition-unslop inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#eef0f5] px-3.5 text-xs font-medium text-[#0b0d14] hover:bg-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8]"
          >
            <Download size={16} strokeWidth={1.5} aria-hidden="true" />
            <span>Download {downloadFileName}</span>
          </button>
        </div>
      </div>

      {/* Inline Click-to-Inspect Verification Bar */}
      {selectedEntity && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#38bdf8]/40 bg-[#1a1e28] px-3 py-2 text-xs"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Info
              size={16}
              strokeWidth={1.5}
              className="text-[#38bdf8]"
              aria-hidden="true"
            />
            <span className="font-medium text-[#eef0f5]">
              {PII_CATEGORY_META[selectedEntity.category].label}
            </span>
            {selectedEntity.validationNote && (
              <span className="rounded bg-[#0b0d14] px-2 py-0.5 font-mono text-xs text-[#4cc38a]">
                {selectedEntity.validationNote}
              </span>
            )}
            <span className="text-[#a3a9b8]">Output token</span>
            <code className="rounded bg-[#0b0d14] px-2 py-0.5 font-mono text-xs text-[#eef0f5]">
              {selectedEntity.replacement}
            </code>
          </div>
          <button
            type="button"
            onClick={() => setSelectedEntity(null)}
            className="text-xs text-[#a3a9b8] hover:text-[#eef0f5]"
          >
            Dismiss
          </button>
        </div>
      )}

      {effectiveViewMode === 'table' && csvTables ? (
        <div className="overflow-hidden rounded-xl border border-[#eef0f5]/[0.08] bg-[#11141c]">
          <div className="border-b border-[#eef0f5]/[0.08] bg-[#0b0d14]/60 px-4 py-2 text-xs font-medium text-[#eef0f5]">
            Side-by-side CSV cell diff
          </div>
          <div className="custom-scrollbar max-h-64 overflow-auto sm:max-h-72">
            <table className="w-full border-collapse text-left font-mono text-xs tabular-nums">
              <thead className="sticky top-0 z-10 bg-[#0b0d14] text-xs text-[#a3a9b8]">
                <tr>
                  <th className="border-b border-[#eef0f5]/[0.08] px-3 py-2 font-medium">
                    #
                  </th>
                  {(csvTables.sanitizedRows[0] ?? []).map((header, idx) => (
                    <th
                      key={idx}
                      className="border-b border-[#eef0f5]/[0.08] px-3 py-2 font-medium text-[#eef0f5]"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef0f5]/[0.06]">
                {csvTables.sanitizedRows.slice(1).map((row, rIdx) => {
                  const origRow = csvTables.originalRows[rIdx + 1] ?? []
                  return (
                    <tr key={rIdx} className="hover:bg-[#1a1e28]/60">
                      <td className="px-3 py-2 text-[#7a8296]">{rIdx + 1}</td>
                      {row.map((cell, cIdx) => {
                        const origCell = origRow[cIdx] ?? ''
                        const changed = cell !== origCell
                        return (
                          <td
                            key={cIdx}
                            className={`px-3 py-2 ${
                              changed
                                ? 'bg-[#4cc38a]/10 text-[#eef0f5]'
                                : 'text-[#a3a9b8]'
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
          <div className="flex flex-col overflow-hidden rounded-xl border border-[#eef0f5]/[0.08] bg-[#11141c]">
            <div className="flex items-center justify-between border-b border-[#eef0f5]/[0.08] bg-[#0b0d14]/50 px-4 py-2">
              <div className="flex items-center gap-2">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-[#e5484d]"
                  aria-hidden="true"
                />
                <label
                  htmlFor="raw-pii-input"
                  className="text-xs font-medium text-[#eef0f5]"
                >
                  Original input
                </label>
              </div>
              <div
                role="tablist"
                aria-label="Original input view mode"
                className="inline-flex rounded-lg border border-[#eef0f5]/[0.08] bg-[#0b0d14] p-0.5"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={leftTab === 'edit'}
                  onClick={() => setLeftTab('edit')}
                  className={`transition-unslop inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-xs font-medium sm:px-2.5 ${
                    leftTab === 'edit'
                      ? 'surface-active bg-[#1a1e28] text-[#eef0f5]'
                      : 'text-[#a3a9b8] hover:text-[#eef0f5]'
                  }`}
                >
                  <FileCode2 size={16} strokeWidth={1.5} aria-hidden="true" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={leftTab === 'highlights'}
                  onClick={() => setLeftTab('highlights')}
                  className={`transition-unslop inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-xs font-medium sm:px-2.5 ${
                    leftTab === 'highlights'
                      ? 'surface-active bg-[#1a1e28] text-[#eef0f5]'
                      : 'text-[#a3a9b8] hover:text-[#eef0f5]'
                  }`}
                >
                  <Eye size={16} strokeWidth={1.5} aria-hidden="true" />
                  <span>Highlights ({result.totalEntities})</span>
                </button>
              </div>
            </div>

            {leftTab === 'edit' ? (
              <textarea
                id="raw-pii-input"
                value={rawInput}
                onChange={(e) => onRawInputChange(e.target.value)}
                placeholder="Paste raw logs, resumes, support tickets, clinical notes, or CSV rows"
                spellCheck={false}
                className="custom-scrollbar h-52 w-full resize-y bg-transparent p-4 font-mono text-[13px] leading-relaxed text-[#eef0f5] placeholder:text-[#7a8296] focus:outline-none sm:h-64"
              />
            ) : (
              <div
                ref={leftScrollRef}
                onScroll={() => handleSyncScroll('left')}
                aria-label="Original text with detected PII highlighted"
                className="custom-scrollbar h-52 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-[13px] leading-relaxed text-[#eef0f5] sm:h-64"
              >
                {renderHighlightedSegments(
                  result.originalSegments,
                  'original',
                  selectedEntity?.id ?? null,
                  setSelectedEntity
                )}
              </div>
            )}

            <div className="flex items-center justify-between border-t border-[#eef0f5]/[0.06] bg-[#0b0d14]/40 px-4 py-1.5 font-mono text-xs tabular-nums text-[#7a8296]">
              <span>
                {lineCount} lines · {rawInput.length} chars
              </span>
              <span>Browser memory only</span>
            </div>
          </div>

          {/* Right Pane: Sanitized Diff Output */}
          <div className="flex flex-col overflow-hidden rounded-xl border border-[#eef0f5]/[0.08] bg-[#11141c]">
            <div className="flex items-center justify-between border-b border-[#eef0f5]/[0.08] bg-[#0b0d14]/50 px-4 py-2">
              <div className="flex items-center gap-2">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-[#4cc38a]"
                  aria-hidden="true"
                />
                <span className="text-xs font-medium text-[#eef0f5]">
                  Sanitized output
                </span>
              </div>
              <span
                aria-live="polite"
                className="font-mono text-xs tabular-nums text-[#a3a9b8]"
              >
                {result.totalEntities} redacted · {result.processingMs} ms
              </span>
            </div>

            <div
              ref={rightScrollRef}
              onScroll={() => handleSyncScroll('right')}
              aria-label="Sanitized output diff preview"
              className="custom-scrollbar h-52 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-[13px] leading-relaxed text-[#eef0f5] sm:h-64"
            >
              {renderHighlightedSegments(
                result.sanitizedSegments,
                'sanitized',
                selectedEntity?.id ?? null,
                setSelectedEntity
              )}
            </div>

            <div className="flex items-center justify-between border-t border-[#eef0f5]/[0.06] bg-[#0b0d14]/40 px-4 py-1.5 font-mono text-xs tabular-nums text-[#7a8296]">
              <span>{result.sanitizedText.length} sanitized chars</span>
              <span>Click any badge to inspect</span>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
