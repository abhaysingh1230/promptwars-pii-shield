import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import {
  Check,
  Copy,
  Download,
  Eye,
  FileCode2,
  FileText,
  Info,
  Link2,
  Table2,
  Upload,
} from 'lucide-react'
import { SAMPLE_DATASETS, type SampleDataset } from '../data/samples'
import { parseCsv } from '../engine/csv'
import {
  BUILTIN_CATEGORIES,
  PII_CATEGORY_META,
  type DiffSegment,
  type PiiEntity,
  type SanitizeResult,
} from '../engine/types'

interface DiffViewerProps {
  rawInput: string
  onRawInputChange: (value: string) => void
  result: SanitizeResult
  isProcessing: boolean
  downloadFileName: string
  onDownloadSanitized: () => void
  onLoadSample: (sample: SampleDataset) => void
  onRequestUpload: () => void
}

function renderHighlightedSegments(
  segments: DiffSegment[],
  variant: 'original' | 'sanitized',
  selectedId: string | null,
  onSelectEntity: (entity: PiiEntity) => void
) {
  if (segments.length === 0) {
    return null
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
        className={`transition-ui inline cursor-pointer rounded px-1 py-0.5 font-mono text-[13px] ${
          variant === 'original' ? meta.highlightClass : meta.redactedClass
        } ${isSelected ? 'ring-2 ring-[#22d3ee]' : ''}`}
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
  isProcessing,
  downloadFileName,
  onDownloadSanitized,
  onLoadSample,
  onRequestUpload,
}: DiffViewerProps) {
  const [copied, setCopied] = useState(false)
  const [downloadAnnouncement, setDownloadAnnouncement] = useState('')
  const [leftTab, setLeftTab] = useState<'edit' | 'highlights'>('edit')
  const [viewMode, setViewMode] = useState<'text' | 'table'>('text')
  const [syncScroll, setSyncScroll] = useState(true)
  const [selectedEntity, setSelectedEntity] = useState<PiiEntity | null>(null)

  const leftScrollRef = useRef<HTMLDivElement>(null)
  const rightScrollRef = useRef<HTMLDivElement>(null)
  const editTabRef = useRef<HTMLButtonElement>(null)
  const highlightsTabRef = useRef<HTMLButtonElement>(null)
  const isSyncingRef = useRef(false)

  function handleLeftTabKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      const next = leftTab === 'edit' ? 'highlights' : 'edit'
      setLeftTab(next)
      if (next === 'edit') editTabRef.current?.focus()
      else highlightsTabRef.current?.focus()
    }
  }

  const csvTables = useMemo(() => {
    if (!result.isCsv || result.csvParseError) return null
    return {
      originalRows: parseCsv(result.originalText),
      sanitizedRows: parseCsv(result.sanitizedText),
    }
  }, [
    result.isCsv,
    result.csvParseError,
    result.originalText,
    result.sanitizedText,
  ])

  const effectiveViewMode = result.isCsv && !result.csvParseError ? viewMode : 'text'
  const lineCount = rawInput ? rawInput.split(/\r\n|\r|\n/).length : 0
  const hasChecksumUnverifiedAadhaar = result.entities.some(
    (e) =>
      e.category === 'aadhaar' &&
      e.validationNote === 'Format-matched · checksum unverified'
  )

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

  function handleDownloadClick() {
    onDownloadSanitized()
    setDownloadAnnouncement(`Downloaded ${downloadFileName}`)
    setTimeout(() => setDownloadAnnouncement(''), 2500)
  }

  return (
    <section aria-labelledby="diff-heading" className="space-y-3">
      {/* Top Diff Toolbar + Compact Color Legend */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="diff-heading" className="text-sm font-medium text-[#eef0f5]">
            Sanitization workspace
          </h2>
          <span className="inline-flex items-center gap-1.5 font-mono text-xs text-[#a3a9b8]">
            <span
              className="h-1.5 w-1.5 rounded-full bg-[#4cc38a]"
              aria-hidden="true"
            />
            <span>Processed in this browser</span>
          </span>
          {result.isCsv && !result.csvParseError && (
            <span className="font-mono text-xs tabular-nums text-[#a3a9b8]">
              CSV · {result.csvRowCount} rows × {result.csvColCount} cols
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {result.isCsv && !result.csvParseError && (
            <div
              role="group"
              aria-label="CSV view format"
              className="inline-flex rounded-lg border border-[#eef0f5]/[0.08] bg-[#0f131b] p-0.5"
            >
              <button
                type="button"
                aria-pressed={effectiveViewMode === 'text'}
                onClick={() => setViewMode('text')}
                className={`transition-ui inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium ${
                  effectiveViewMode === 'text'
                    ? 'surface-active bg-[#161b26] text-[#eef0f5]'
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
                className={`transition-ui inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium ${
                  effectiveViewMode === 'table'
                    ? 'surface-active bg-[#161b26] text-[#eef0f5]'
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
            className={`transition-ui inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee] ${
              syncScroll
                ? 'surface-active border-[#22d3ee]/50 bg-[#161b26] text-[#eef0f5]'
                : 'border-[#eef0f5]/[0.08] bg-[#0f131b] text-[#a3a9b8] hover:text-[#eef0f5]'
            }`}
            title="Synchronize scrolling between original and sanitized panes"
          >
            <Link2 size={16} strokeWidth={1.5} aria-hidden="true" />
            <span>Sync scroll</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            disabled={!result.sanitizedText || Boolean(result.csvParseError)}
            className="transition-ui inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#eef0f5]/[0.1] bg-[#161b26] px-3 text-xs font-medium text-[#eef0f5] hover:border-[#22d3ee]/50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee]"
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
                <span>Copy</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadClick}
            disabled={!result.sanitizedText || Boolean(result.csvParseError)}
            className="transition-ui inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#eef0f5] px-3.5 text-xs font-medium text-[#090b10] hover:bg-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee]"
          >
            <Download size={16} strokeWidth={1.5} aria-hidden="true" />
            <span>Download {downloadFileName}</span>
          </button>
        </div>
      </div>

      {/* Compact Color Legend + Accessible Live Status Feedback */}
      <div className="flex flex-col gap-2 rounded-lg border border-[#eef0f5]/[0.08] bg-[#0f131b] px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
        <div
          aria-label="Entity color legend"
          className="flex flex-wrap items-center gap-x-4 gap-y-1"
        >
          {BUILTIN_CATEGORIES.map((cat) => {
            const meta = PII_CATEGORY_META[cat]
            return (
              <span
                key={cat}
                className="inline-flex items-center gap-1.5 font-mono text-xs tabular-nums text-[#a3a9b8]"
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`}
                  aria-hidden="true"
                />
                <span>
                  {meta.shortLabel}: {result.countsByCategory[cat]}
                </span>
              </span>
            )
          })}
        </div>

        <div
          aria-live="polite"
          className="font-mono text-xs tabular-nums text-[#a3a9b8]"
        >
          {isProcessing
            ? 'Scanning in background worker...'
            : downloadAnnouncement
              ? downloadAnnouncement
              : copied
                ? 'Copied sanitized output to clipboard'
                : `${result.totalEntities} entities detected · ${result.processingMs} ms`}
        </div>
      </div>

      {/* Explicit Malformed CSV Error */}
      {result.csvParseError && (
        <div
          role="alert"
          className="rounded-lg border border-[#e5484d]/50 bg-[#e5484d]/10 px-3.5 py-2.5 text-xs text-[#eef0f5]"
        >
          <span className="font-medium">CSV parsing error: </span>
          <span>{result.csvParseError}</span>
        </div>
      )}

      {/* Format-matched checksum unverified notice */}
      {hasChecksumUnverifiedAadhaar && (
        <p className="text-xs text-[#a3a9b8]">
          Note: One or more 12-digit numbers matched the Aadhaar layout but did
          not pass a Verhoeff checksum (marked{' '}
          <span className="font-mono text-[#eef0f5]">
            Format-matched · checksum unverified
          </span>
          ) so synthetic test IDs are still protected.
        </p>
      )}

      {/* Inline Click-to-Inspect Entity Verification Bar */}
      {selectedEntity && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#22d3ee]/50 bg-[#161b26] px-3 py-2 text-xs"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Info
              size={16}
              strokeWidth={1.5}
              className="text-[#22d3ee]"
              aria-hidden="true"
            />
            <span className="font-medium text-[#eef0f5]">
              {PII_CATEGORY_META[selectedEntity.category].label}
            </span>
            {selectedEntity.validationNote && (
              <span className="rounded bg-[#090b10] px-2 py-0.5 font-mono text-xs text-[#4cc38a]">
                {selectedEntity.validationNote}
              </span>
            )}
            <span className="text-[#a3a9b8]">Output token</span>
            <code className="rounded bg-[#090b10] px-2 py-0.5 font-mono text-xs text-[#eef0f5]">
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

      {/* Main Two-Pane Diff or CSV Table View */}
      {effectiveViewMode === 'table' && csvTables ? (
        <div className="overflow-hidden rounded-xl border border-[#eef0f5]/[0.08] bg-[#0f131b]">
          <div className="flex items-center justify-between border-b border-[#eef0f5]/[0.08] bg-[#090b10]/60 px-4 py-2 text-xs font-medium text-[#eef0f5]">
            <span>CSV table view (sanitized cells)</span>
            <span className="font-mono text-xs text-[#7a8296]">
              Formula-leading cells escaped on download
            </span>
          </div>
          <div className="custom-scrollbar max-h-72 overflow-auto sm:max-h-80">
            <table className="w-full border-collapse text-left font-mono text-xs tabular-nums">
              <thead className="sticky top-0 z-10 bg-[#090b10] text-xs text-[#a3a9b8]">
                <tr>
                  <th className="border-b border-[#eef0f5]/[0.08] px-3 py-2 font-medium">
                    Row
                  </th>
                  {(csvTables.sanitizedRows[0] ?? []).map((header, idx) => (
                    <th
                      key={idx}
                      className="border-b border-[#eef0f5]/[0.08] px-3 py-2 font-medium text-[#eef0f5]"
                    >
                      Col {idx + 1}: {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef0f5]/[0.06]">
                {csvTables.sanitizedRows.slice(1).map((row, rIdx) => {
                  const origRow = csvTables.originalRows[rIdx + 1] ?? []
                  return (
                    <tr key={rIdx} className="hover:bg-[#161b26]/70">
                      <td className="px-3 py-2 align-top text-[#7a8296]">
                        {rIdx + 1}
                      </td>
                      {row.map((cell, cIdx) => {
                        const origCell = origRow[cIdx] ?? ''
                        const changed = cell !== origCell
                        const isMultiline = cell.includes('\n')
                        return (
                          <td
                            key={cIdx}
                            className={`whitespace-pre-wrap px-3 py-2 align-top ${
                              changed
                                ? 'bg-[#4cc38a]/10 text-[#eef0f5]'
                                : 'text-[#a3a9b8]'
                            }`}
                            title={
                              changed ? `Original: ${origCell}` : 'Unchanged'
                            }
                          >
                            {isMultiline && (
                              <span className="mb-1 inline-block rounded border border-[#22d3ee]/40 bg-[#090b10] px-1.5 py-0.5 text-xs text-[#22d3ee]">
                                multiline cell
                              </span>
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
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Left Pane: Original */}
          <div className="flex flex-col overflow-hidden rounded-xl border border-[#eef0f5]/[0.08] bg-[#0f131b]">
            <div className="flex items-center justify-between border-b border-[#eef0f5]/[0.08] bg-[#090b10]/60 px-4 py-2">
              <div className="flex items-center gap-2">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-[#e5484d]"
                  aria-hidden="true"
                />
                <label
                  htmlFor="raw-pii-input"
                  className="text-xs font-medium text-[#eef0f5]"
                >
                  Original
                </label>
              </div>
              <div
                role="tablist"
                aria-label="Original pane mode"
                className="inline-flex rounded-lg border border-[#eef0f5]/[0.08] bg-[#090b10] p-0.5"
              >
                <button
                  ref={editTabRef}
                  type="button"
                  role="tab"
                  aria-selected={leftTab === 'edit'}
                  tabIndex={leftTab === 'edit' ? 0 : -1}
                  onClick={() => setLeftTab('edit')}
                  onKeyDown={handleLeftTabKeyDown}
                  className={`transition-ui inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee] ${
                    leftTab === 'edit'
                      ? 'surface-active bg-[#161b26] text-[#eef0f5]'
                      : 'text-[#a3a9b8] hover:text-[#eef0f5]'
                  }`}
                >
                  <FileCode2 size={16} strokeWidth={1.5} aria-hidden="true" />
                  <span>Edit</span>
                </button>
                <button
                  ref={highlightsTabRef}
                  type="button"
                  role="tab"
                  aria-selected={leftTab === 'highlights'}
                  tabIndex={leftTab === 'highlights' ? 0 : -1}
                  onClick={() => setLeftTab('highlights')}
                  onKeyDown={handleLeftTabKeyDown}
                  className={`transition-ui inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee] ${
                    leftTab === 'highlights'
                      ? 'surface-active bg-[#161b26] text-[#eef0f5]'
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
                aria-label="Original input text"
                value={rawInput}
                onChange={(e) => onRawInputChange(e.target.value)}
                placeholder="Paste text or upload a .txt / .csv file to detect and redact PII in this browser"
                spellCheck={false}
                className="custom-scrollbar h-64 w-full resize-y bg-transparent p-4 font-mono text-[13px] leading-relaxed text-[#eef0f5] placeholder:text-[#7a8296] focus:outline-none sm:h-72"
              />
            ) : (
              <div
                ref={leftScrollRef}
                onScroll={() => handleSyncScroll('left')}
                aria-label="Original text with detected PII highlighted"
                className="custom-scrollbar h-64 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-[13px] leading-relaxed text-[#eef0f5] sm:h-72"
              >
                {rawInput ? (
                  renderHighlightedSegments(
                    result.originalSegments,
                    'original',
                    selectedEntity?.id ?? null,
                    setSelectedEntity
                  )
                ) : (
                  <span className="text-[#7a8296]">
                    Paste text or upload a file to inspect highlighted entities
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center justify-between border-t border-[#eef0f5]/[0.06] bg-[#090b10]/40 px-4 py-1.5 font-mono text-xs tabular-nums text-[#8b93a7]">
              <span>
                {lineCount} lines · {rawInput.length} chars
              </span>
              <span>Local browser memory</span>
            </div>
          </div>

          {/* Right Pane: Sanitized */}
          <div className="flex flex-col overflow-hidden rounded-xl border border-[#eef0f5]/[0.08] bg-[#0f131b]">
            <div className="flex items-center justify-between border-b border-[#eef0f5]/[0.08] bg-[#090b10]/60 px-4 py-2">
              <div className="flex items-center gap-2">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-[#4cc38a]"
                  aria-hidden="true"
                />
                <span className="text-xs font-medium text-[#eef0f5]">
                  Sanitized
                </span>
              </div>
              <span className="font-mono text-xs tabular-nums text-[#a3a9b8]">
                {result.totalEntities} redacted
              </span>
            </div>

            {rawInput ? (
              <div
                ref={rightScrollRef}
                onScroll={() => handleSyncScroll('right')}
                aria-label="Sanitized output diff preview"
                className="custom-scrollbar h-64 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-[13px] leading-relaxed text-[#eef0f5] sm:h-72"
              >
                {renderHighlightedSegments(
                  result.sanitizedSegments,
                  'sanitized',
                  selectedEntity?.id ?? null,
                  setSelectedEntity
                )}
              </div>
            ) : (
              <div
                aria-label="Sanitized output diff preview"
                className="flex h-64 flex-col items-center justify-center gap-3 p-6 text-center sm:h-72"
              >
                <p className="text-sm font-medium text-[#eef0f5]">
                  Paste text or upload a file
                </p>
                <p className="max-w-sm text-xs text-[#7a8296]">
                  All pattern matching, Luhn credit card checks, and redaction
                  run locally inside this tab.
                </p>
                <div className="flex flex-wrap justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onLoadSample(SAMPLE_DATASETS[0])}
                    className="transition-ui inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#eef0f5]/[0.1] bg-[#161b26] px-3 text-xs font-medium text-[#eef0f5] hover:border-[#22d3ee]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee]"
                  >
                    <FileText size={16} strokeWidth={1.5} aria-hidden="true" />
                    <span>Load fictional sample</span>
                  </button>
                  <button
                    type="button"
                    onClick={onRequestUpload}
                    className="transition-ui inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#eef0f5]/[0.1] bg-[#090b10] px-3 text-xs font-medium text-[#a3a9b8] hover:text-[#eef0f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee]"
                  >
                    <Upload size={16} strokeWidth={1.5} aria-hidden="true" />
                    <span>Upload .txt / .csv</span>
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-[#eef0f5]/[0.06] bg-[#090b10]/40 px-4 py-1.5 font-mono text-xs tabular-nums text-[#8b93a7]">
              <span>{result.sanitizedText.length} sanitized chars</span>
              <span>Click any badge to inspect</span>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
