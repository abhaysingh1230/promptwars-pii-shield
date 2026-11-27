import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import {
  ArrowDown,
  ArrowRight,
  Check,
  Copy,
  Download,
  Eye,
  FileCode2,
  FileText,
  Info,
  Link2,
  ShieldCheck,
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
  type RedactionMode,
  type SanitizeResult,
} from '../engine/types'

interface DiffViewerProps {
  rawInput: string
  onRawInputChange: (value: string) => void
  result: SanitizeResult
  mode: RedactionMode
  isProcessing: boolean
  downloadFileName: string
  onDownloadSanitized: () => void
  onLoadSample: (sample: SampleDataset) => void
  onRequestUpload: () => void
}

const MODE_SHORT_LABEL: Record<RedactionMode, string> = {
  full: 'Full mask',
  partial: 'Partial mask',
  pseudonym: 'Pseudonym',
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
  mode,
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

  // Key forces brief CSS sweep only when input content or mode actually changes
  const sweepKey = `${mode}:${rawInput.length}:${result.totalEntities}`

  function handleLeftTabKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      const next = leftTab === 'edit' ? 'highlights' : 'edit'
      setLeftTab(next)
      if (next === 'edit') editTabRef.current?.focus()
      else highlightsTabRef.current?.focus()
    }
  }

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
      {/* Workspace Header Bar */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <h2
            id="diff-heading"
            className="font-display text-base font-medium text-[#f1f5f9]"
          >
            Sanitization workspace
          </h2>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-[#e2e8f0]/[0.08] bg-[#0d1118] px-2 py-0.5 font-mono text-xs text-[#a3a9b8]">
            <span
              className="h-1.5 w-1.5 rounded-full bg-[#34d399]"
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
              className="instrument-recessed inline-flex rounded-lg border border-[#e2e8f0]/[0.08] p-0.5"
            >
              <button
                type="button"
                aria-pressed={effectiveViewMode === 'text'}
                onClick={() => setViewMode('text')}
                className={`transition-ui inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium ${
                  effectiveViewMode === 'text'
                    ? 'surface-active bg-[#171f2e] text-[#f1f5f9]'
                    : 'text-[#94a3b8] hover:text-[#f1f5f9]'
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
                    ? 'surface-active bg-[#171f2e] text-[#f1f5f9]'
                    : 'text-[#94a3b8] hover:text-[#f1f5f9]'
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
                ? 'surface-active border-[#22d3ee]/50 bg-[#151c29] text-[#f1f5f9]'
                : 'border-[#e2e8f0]/[0.08] bg-[#0e1219] text-[#94a3b8] hover:text-[#f1f5f9]'
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
            className="transition-ui inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#e2e8f0]/[0.1] bg-[#151b26] px-3 text-xs font-medium text-[#f1f5f9] hover:border-[#22d3ee]/50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee]"
          >
            {copied ? (
              <>
                <Check
                  size={16}
                  strokeWidth={1.5}
                  className="text-[#34d399]"
                  aria-hidden="true"
                />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy
                  size={16}
                  strokeWidth={1.5}
                  className="text-[#94a3b8]"
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
            className="transition-ui inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#f1f5f9] px-3.5 text-xs font-medium text-[#080a0f] hover:bg-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee]"
          >
            <Download size={16} strokeWidth={1.5} aria-hidden="true" />
            <span>Download {downloadFileName}</span>
          </button>
        </div>
      </div>

      {/* Instrument Status Strip & Compact Category Legend */}
      <div className="flex flex-col gap-2 rounded-lg border border-[#e2e8f0]/[0.08] bg-[#0c1018] px-3.5 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
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
                : `${result.totalEntities} entities · ${MODE_SHORT_LABEL[mode]} · ${result.processingMs} ms`}
        </div>
      </div>

      {/* Explicit Malformed CSV Error */}
      {result.csvParseError && (
        <div
          role="alert"
          className="rounded-lg border border-[#e5484d]/50 bg-[#e5484d]/10 px-3.5 py-2.5 text-xs text-[#f1f5f9]"
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
          <span className="font-mono text-[#f1f5f9]">
            Format-matched · checksum unverified
          </span>
          ) so synthetic test IDs are still masked.
        </p>
      )}

      {/* Precision Selected Entity Detail Popover */}
      {selectedEntity && (
        <div
          role="status"
          aria-label="Selected entity validation details"
          className="instrument-panel flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#22d3ee]/50 px-3.5 py-2.5 text-xs"
        >
          <div className="flex flex-wrap items-center gap-2.5">
            <Info
              size={16}
              strokeWidth={1.5}
              className="text-[#22d3ee]"
              aria-hidden="true"
            />
            <span
              className={`h-2 w-2 rounded-full ${
                PII_CATEGORY_META[selectedEntity.category].dotClass
              }`}
              aria-hidden="true"
            />
            <span className="font-medium text-[#f1f5f9]">
              {PII_CATEGORY_META[selectedEntity.category].label}
            </span>
            {selectedEntity.validationNote && (
              <span className="rounded border border-[#34d399]/30 bg-[#090c12] px-2 py-0.5 font-mono text-xs text-[#34d399]">
                {selectedEntity.validationNote}
              </span>
            )}
            <span className="text-[#8b93a7]">Replacement</span>
            <code className="rounded border border-[#e2e8f0]/[0.08] bg-[#090c12] px-2 py-0.5 font-mono text-xs text-[#f1f5f9]">
              {selectedEntity.replacement}
            </code>
          </div>
          <button
            type="button"
            onClick={() => setSelectedEntity(null)}
            className="rounded px-2 py-0.5 text-xs text-[#a3a9b8] hover:text-[#f1f5f9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Connected Centerpiece */}
      {effectiveViewMode === 'table' && csvTables ? (
        <div className="protected-panel overflow-hidden rounded-xl border border-[#34d399]/30">
          <div className="flex items-center justify-between border-b border-[#e2e8f0]/[0.08] bg-[#090c12]/80 px-4 py-2.5 text-xs">
            <div className="flex items-center gap-2 font-medium text-[#f1f5f9]">
              <ShieldCheck
                size={16}
                strokeWidth={1.5}
                className="text-[#34d399]"
                aria-hidden="true"
              />
              <span>CSV table view (protected output)</span>
            </div>
            <span className="font-mono text-xs text-[#8b93a7]">
              Formula-leading cells escaped on download
            </span>
          </div>
          <div className="custom-scrollbar max-h-72 overflow-auto sm:max-h-80">
            <table className="w-full border-collapse text-left font-mono text-xs tabular-nums">
              <thead className="sticky top-0 z-10 bg-[#080a0f] text-xs text-[#a3a9b8]">
                <tr>
                  <th className="border-b border-[#e2e8f0]/[0.08] px-3 py-2 font-medium">
                    Row
                  </th>
                  {(csvTables.sanitizedRows[0] ?? []).map((header, idx) => (
                    <th
                      key={idx}
                      className="border-b border-[#e2e8f0]/[0.08] px-3 py-2 font-medium text-[#f1f5f9]"
                    >
                      Col {idx + 1}: {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0]/[0.06]">
                {csvTables.sanitizedRows.slice(1).map((row, rIdx) => {
                  const origRow = csvTables.originalRows[rIdx + 1] ?? []
                  return (
                    <tr key={rIdx} className="hover:bg-[#151b26]/70">
                      <td className="px-3 py-2 align-top text-[#8b93a7]">
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
                                ? 'bg-[#34d399]/10 text-[#f1f5f9]'
                                : 'text-[#a3a9b8]'
                            }`}
                            title={
                              changed ? `Original: ${origCell}` : 'Unchanged'
                            }
                          >
                            {isMultiline && (
                              <span className="mb-1 inline-block rounded border border-[#22d3ee]/40 bg-[#090c12] px-1.5 py-0.5 text-xs text-[#22d3ee]">
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
        <div className="grid gap-3 lg:grid-cols-[1fr_28px_1fr] lg:items-stretch lg:gap-0">
          {/* Left Panel: Original (Raw / Untrusted Source) */}
          <div className="instrument-panel flex min-w-0 flex-col overflow-hidden rounded-xl border border-[#e2e8f0]/[0.09]">
            <div className="flex items-center justify-between border-b border-[#e2e8f0]/[0.08] bg-[#090c12]/70 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full bg-[#e5484d]"
                  aria-hidden="true"
                />
                <label
                  htmlFor="raw-pii-input"
                  className="font-display text-xs font-medium text-[#f1f5f9]"
                >
                  Original
                </label>
              </div>
              <div
                role="tablist"
                aria-label="Original pane mode"
                className="instrument-recessed inline-flex rounded-lg border border-[#e2e8f0]/[0.08] p-0.5"
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
                      ? 'surface-active bg-[#171f2e] text-[#f1f5f9]'
                      : 'text-[#94a3b8] hover:text-[#f1f5f9]'
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
                      ? 'surface-active bg-[#171f2e] text-[#f1f5f9]'
                      : 'text-[#94a3b8] hover:text-[#f1f5f9]'
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
                className="custom-scrollbar h-64 w-full resize-y bg-transparent p-4 font-mono text-[13px] leading-relaxed text-[#f1f5f9] placeholder:text-[#8b93a7] focus:outline-none sm:h-80"
              />
            ) : (
              <div
                ref={leftScrollRef}
                onScroll={() => handleSyncScroll('left')}
                aria-label="Original text with detected PII highlighted"
                className="custom-scrollbar h-64 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-[13px] leading-relaxed text-[#f1f5f9] sm:h-80"
              >
                {rawInput ? (
                  renderHighlightedSegments(
                    result.originalSegments,
                    'original',
                    selectedEntity?.id ?? null,
                    setSelectedEntity
                  )
                ) : (
                  <span className="text-[#8b93a7]">
                    Paste text or upload a file to inspect highlighted entities
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center justify-between border-t border-[#e2e8f0]/[0.07] bg-[#090c12]/60 px-4 py-1.5 font-mono text-xs tabular-nums text-[#8b93a7]">
              <span>
                {lineCount} lines · {rawInput.length} chars
              </span>
              <span>Local browser memory</span>
            </div>
          </div>

          {/* Visual Transformation Connector */}
          <div
            aria-hidden="true"
            className="flex items-center justify-center lg:flex-col"
          >
            <div className="h-px flex-1 bg-[#e2e8f0]/[0.08] lg:h-auto lg:w-px" />
            <div className="mx-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#22d3ee]/40 bg-[#0d1119] text-[#22d3ee] lg:mx-0 lg:my-2">
              <ArrowRight
                size={14}
                strokeWidth={1.75}
                className="hidden lg:block"
              />
              <ArrowDown
                size={14}
                strokeWidth={1.75}
                className="block lg:hidden"
              />
            </div>
            <div className="h-px flex-1 bg-[#e2e8f0]/[0.08] lg:h-auto lg:w-px" />
          </div>

          {/* Right Panel: Sanitized (Protected Destination) */}
          <div className="protected-panel relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-[#34d399]/35">
            {/* Brief, reduced-motion-safe transformation sweep on update */}
            <div
              key={sweepKey}
              aria-hidden="true"
              className="scan-sweep-line pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#22d3ee] to-transparent"
            />

            <div className="flex items-center justify-between border-b border-[#34d399]/20 bg-[#090e12]/80 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full bg-[#34d399]"
                  aria-hidden="true"
                />
                <span className="font-display text-xs font-medium text-[#f1f5f9]">
                  Sanitized
                </span>
                <span className="rounded border border-[#34d399]/30 bg-[#34d399]/10 px-1.5 py-0.5 font-mono text-xs text-[#34d399]">
                  Protected output
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
                className="custom-scrollbar h-64 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-[13px] leading-relaxed text-[#f1f5f9] sm:h-80"
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
                className="flex h-64 flex-col items-center justify-center gap-3 p-6 text-center sm:h-80"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#34d399]/30 bg-[#0c1418]">
                  <ShieldCheck
                    size={18}
                    strokeWidth={1.5}
                    className="text-[#34d399]"
                    aria-hidden="true"
                  />
                </div>
                <p className="font-display text-sm font-medium text-[#f1f5f9]">
                  Paste text or upload a file
                </p>
                <p className="max-w-sm text-xs text-[#a3a9b8]">
                  Pattern detection, Luhn checks, and redaction execute locally
                  inside this browser tab.
                </p>
                <div className="flex flex-wrap justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onLoadSample(SAMPLE_DATASETS[0])}
                    className="transition-ui inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#e2e8f0]/[0.12] bg-[#151b26] px-3 text-xs font-medium text-[#f1f5f9] hover:border-[#22d3ee]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee]"
                  >
                    <FileText size={16} strokeWidth={1.5} aria-hidden="true" />
                    <span>Load fictional sample</span>
                  </button>
                  <button
                    type="button"
                    onClick={onRequestUpload}
                    className="transition-ui inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#e2e8f0]/[0.1] bg-[#090c12] px-3 text-xs font-medium text-[#cbd5e1] hover:border-[#22d3ee]/40 hover:text-[#f1f5f9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee]"
                  >
                    <Upload size={16} strokeWidth={1.5} aria-hidden="true" />
                    <span>Upload .txt / .csv</span>
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-[#34d399]/15 bg-[#090e12]/60 px-4 py-1.5 font-mono text-xs tabular-nums text-[#8b93a7]">
              <span>{result.sanitizedText.length} sanitized chars</span>
              <span>Click any badge to inspect</span>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
