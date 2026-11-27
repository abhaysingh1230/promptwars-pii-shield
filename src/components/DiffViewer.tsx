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

function isVerifiedEntity(entity: PiiEntity): boolean {
  if (
    entity.category === 'credit_card' ||
    entity.category === 'phone' ||
    entity.category === 'ip_address'
  ) {
    return true
  }
  if (entity.category === 'aadhaar') {
    return entity.validationNote === 'Verhoeff checksum verified'
  }
  return false
}

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
        } ${isSelected ? 'pii-selected ring-1 ring-[var(--accent-solid)]' : ''}`}
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

  const activeSelectedEntity = useMemo(() => {
    if (!rawInput || !selectedEntity) return null
    return result.entities.find((e) => e.id === selectedEntity.id) ?? selectedEntity
  }, [rawInput, selectedEntity, result.entities])

  const verifiedCount = useMemo(
    () => result.entities.filter(isVerifiedEntity).length,
    [result.entities]
  )
  const formatOnlyCount = result.totalEntities - verifiedCount

  // Key triggers brief directional update cue only when non-empty result changes
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
            className="font-display text-base font-medium text-[var(--text-primary)]"
          >
            Sanitization workspace
          </h2>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-recessed)] px-2 py-0.5 font-mono text-xs text-[var(--text-secondary)]">
            <span
              className="h-1.5 w-1.5 rounded-full bg-[var(--text-safe)]"
              aria-hidden="true"
            />
            <span>Processed in this browser</span>
          </span>
          {result.isCsv && !result.csvParseError && (
            <span className="font-mono text-xs tabular-nums text-[var(--text-secondary)]">
              CSV · {result.csvRowCount} rows × {result.csvColCount} cols
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {result.isCsv && !result.csvParseError && (
            <div
              role="group"
              aria-label="CSV view format"
              className="instrument-recessed inline-flex rounded-lg border border-[var(--border-subtle)] p-0.5"
            >
              <button
                type="button"
                aria-pressed={effectiveViewMode === 'text'}
                onClick={() => setViewMode('text')}
                className={`transition-ui inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium ${
                  effectiveViewMode === 'text'
                    ? 'surface-active bg-[var(--bg-active)] text-[var(--text-primary)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
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
                    ? 'surface-active bg-[var(--bg-active)] text-[var(--text-primary)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
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
            className={`transition-ui inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-solid)] ${
              syncScroll
                ? 'surface-active border-[var(--border-accent)] bg-[var(--bg-active)] text-[var(--text-primary)]'
                : 'border-[var(--border-subtle)] bg-[var(--bg-recessed)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
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
            className="transition-ui inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-panel)] px-3 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--border-accent)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-solid)]"
          >
            {copied ? (
              <>
                <Check
                  size={16}
                  strokeWidth={1.5}
                  className="text-[var(--text-safe)]"
                  aria-hidden="true"
                />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy
                  size={16}
                  strokeWidth={1.5}
                  className="text-[var(--text-muted)]"
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
            className="transition-ui inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--cta-solid)] px-3.5 text-xs font-medium text-[var(--cta-solid-text)] hover:bg-[var(--cta-solid-hover)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-solid)]"
          >
            <Download size={16} strokeWidth={1.5} aria-hidden="true" />
            <span>Download {downloadFileName}</span>
          </button>
        </div>
      </div>

      {/* Instrument Status Strip & Compact Category Legend */}
      <div className="instrument-panel flex flex-col gap-2 rounded-xl border border-[var(--border-subtle)] px-3.5 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between">
        <div
          aria-label="Entity color legend"
          className="flex flex-wrap items-center gap-1.5"
        >
          {BUILTIN_CATEGORIES.map((cat) => {
            const meta = PII_CATEGORY_META[cat]
            const count = result.countsByCategory[cat]
            return (
              <span
                key={cat}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-xs tabular-nums transition-ui ${
                  count > 0
                    ? 'border-[var(--border-strong)] bg-[var(--bg-badge)] text-[var(--text-primary)]'
                    : 'border-transparent bg-[var(--bg-recessed)]/60 text-[var(--text-muted)] opacity-60'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`}
                  aria-hidden="true"
                />
                <span>
                  {meta.shortLabel}: {count}
                </span>
              </span>
            )
          })}
        </div>

        <div
          aria-live="polite"
          className="font-mono text-xs tabular-nums text-[var(--text-secondary)]"
        >
          {isProcessing
            ? 'Scanning in background worker...'
            : downloadAnnouncement
              ? downloadAnnouncement
              : copied
                ? 'Copied sanitized output to clipboard'
                : result.totalEntities > 0
                  ? `${result.totalEntities} entities (${verifiedCount} verified · ${formatOnlyCount} format-only) · ${MODE_SHORT_LABEL[mode]} · ${result.processingMs} ms`
                  : `0 entities · ${MODE_SHORT_LABEL[mode]} · ${result.processingMs} ms`}
        </div>
      </div>

      {/* Explicit Malformed CSV Error */}
      {result.csvParseError && (
        <div
          role="alert"
          className="rounded-lg border border-[#e5484d]/50 bg-[#e5484d]/10 px-3.5 py-2.5 text-xs text-[var(--text-primary)]"
        >
          <span className="font-medium">CSV parsing error: </span>
          <span>{result.csvParseError}</span>
        </div>
      )}

      {/* Format-matched checksum unverified notice */}
      {hasChecksumUnverifiedAadhaar && (
        <p className="text-xs text-[var(--text-secondary)]">
          Note: One or more 12-digit numbers matched the Aadhaar layout but did
          not pass a Verhoeff checksum (marked{' '}
          <span className="font-mono text-[var(--text-primary)]">
            Format-matched · checksum unverified
          </span>
          ) so synthetic test IDs are still masked.
        </p>
      )}

      {/* Precision Selected Entity Detail Popover */}
      {activeSelectedEntity && (
        <div
          role="status"
          aria-label="Selected entity validation details"
          className="instrument-panel animate-card-reveal flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-accent)] px-4 py-2.5 text-xs"
        >
          <div className="flex flex-wrap items-center gap-2.5">
            <Info
              size={16}
              strokeWidth={1.5}
              className="text-[var(--text-accent)]"
              aria-hidden="true"
            />
            <span
              className={`h-2 w-2 rounded-full ${
                PII_CATEGORY_META[activeSelectedEntity.category].dotClass
              }`}
              aria-hidden="true"
            />
            <span className="font-display font-medium text-[var(--text-primary)]">
              {PII_CATEGORY_META[activeSelectedEntity.category].label}
            </span>
            <span
              className={`rounded-md border px-2 py-0.5 font-mono text-xs ${
                isVerifiedEntity(activeSelectedEntity)
                  ? 'border-[var(--border-safe)] bg-[var(--bg-protected-well)] text-[var(--text-safe)]'
                  : 'border-[#f59e0b]/45 bg-[#f59e0b]/10 text-[var(--text-warn)]'
              }`}
            >
              {isVerifiedEntity(activeSelectedEntity)
                ? 'Checksum / plan verified'
                : 'Format-matched · review recommended'}
            </span>
            {activeSelectedEntity.validationNote && (
              <span className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-recessed)] px-2 py-0.5 font-mono text-xs text-[var(--text-secondary)]">
                Why: {activeSelectedEntity.validationNote}
              </span>
            )}
            <span className="text-[var(--text-muted)]">→ Replacement</span>
            <code className="rounded-md border border-[var(--border-strong)] bg-[var(--bg-recessed)] px-2 py-0.5 font-mono text-xs text-[var(--text-primary)]">
              {activeSelectedEntity.replacement}
            </code>
          </div>
          <button
            type="button"
            onClick={() => setSelectedEntity(null)}
            className="transition-ui rounded-md border border-transparent px-2 py-1 text-xs text-[var(--text-secondary)] hover:border-[var(--border-subtle)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-solid)]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Workspace-wide thin scan line active only while Web Worker processing runs */}
      {isProcessing && (
        <div
          aria-hidden="true"
          className="relative h-0.5 w-full overflow-hidden rounded-full bg-[var(--border-subtle)]"
        >
          <div className="processing-scan-line h-full bg-gradient-to-r from-transparent via-[var(--text-accent)] to-transparent" />
        </div>
      )}

      {/* Main Connected Centerpiece */}
      {effectiveViewMode === 'table' && csvTables ? (
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
                  {(csvTables.sanitizedRows[0] ?? []).map((header, idx) => (
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
                {csvTables.sanitizedRows.slice(1).map((row, rIdx) => {
                  const origRow = csvTables.originalRows[rIdx + 1] ?? []
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
                            title={
                              changed ? `Original: ${origCell}` : 'Unchanged'
                            }
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
      ) : (
        <div className="grid gap-3 lg:grid-cols-[1fr_28px_1fr] lg:items-stretch lg:gap-0">
          {/* Left Panel: Original (Raw / Untrusted Source) */}
          <div className="instrument-panel flex min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--border-subtle)]">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-recessed)] px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full bg-[#e5484d]"
                  aria-hidden="true"
                />
                <label
                  htmlFor="raw-pii-input"
                  className="font-display text-xs font-medium text-[var(--text-primary)]"
                >
                  Original
                </label>
              </div>
              <div
                role="tablist"
                aria-label="Original pane mode"
                className="instrument-recessed inline-flex rounded-lg border border-[var(--border-subtle)] p-0.5"
              >
                <button
                  ref={editTabRef}
                  type="button"
                  role="tab"
                  aria-selected={leftTab === 'edit'}
                  tabIndex={leftTab === 'edit' ? 0 : -1}
                  onClick={() => setLeftTab('edit')}
                  onKeyDown={handleLeftTabKeyDown}
                  className={`transition-ui inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-solid)] ${
                    leftTab === 'edit'
                      ? 'surface-active bg-[var(--bg-active)] text-[var(--text-primary)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
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
                  className={`transition-ui inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-solid)] ${
                    leftTab === 'highlights'
                      ? 'surface-active bg-[var(--bg-active)] text-[var(--text-primary)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
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
                className="custom-scrollbar h-64 w-full resize-y bg-transparent p-4 font-mono text-[13px] leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none sm:h-80"
              />
            ) : (
              <div
                ref={leftScrollRef}
                onScroll={() => handleSyncScroll('left')}
                aria-label="Original text with detected PII highlighted"
                className="custom-scrollbar h-64 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-[13px] leading-relaxed text-[var(--text-primary)] sm:h-80"
              >
                {rawInput ? (
                  renderHighlightedSegments(
                    result.originalSegments,
                    'original',
                    activeSelectedEntity?.id ?? null,
                    setSelectedEntity
                  )
                ) : (
                  <span className="text-[var(--text-muted)]">
                    Paste text or upload a file to inspect highlighted entities
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center justify-between border-t border-[var(--border-subtle)] bg-[var(--bg-recessed)] px-4 py-1.5 font-mono text-xs tabular-nums text-[var(--text-muted)]">
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
            <div className="h-px flex-1 bg-gradient-to-r from-[var(--border-subtle)] via-[var(--border-accent)] to-[var(--border-subtle)] opacity-70 lg:h-auto lg:w-px lg:bg-gradient-to-b" />
            <div
              key={rawInput ? `pulse-${sweepKey}` : 'idle'}
              className={`mx-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--border-accent)] bg-[var(--bg-panel)] text-[var(--text-accent)] lg:mx-0 lg:my-2 ${
                rawInput ? 'connector-pulse' : ''
              }`}
            >
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
            <div className="h-px flex-1 bg-gradient-to-r from-[var(--border-subtle)] via-[var(--border-accent)] to-[var(--border-subtle)] opacity-70 lg:h-auto lg:w-px lg:bg-gradient-to-b" />
          </div>

          {/* Right Panel: Sanitized (Protected Destination) */}
          <div className="protected-panel relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--border-safe)]">
            {/* Small inline SVG corner calibration ticks */}
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute right-2 top-2 h-3 w-3 text-[var(--text-safe)] opacity-45"
              viewBox="0 0 12 12"
              fill="none"
            >
              <path d="M2 1H11V10" stroke="currentColor" strokeWidth="1.25" />
            </svg>

            {/* Brief, reduced-motion-safe transformation sweep only when non-empty result updates */}
            {rawInput && (
              <div
                key={sweepKey}
                aria-hidden="true"
                className="scan-sweep-line pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--text-accent)] to-transparent"
              />
            )}

            <div className="flex items-center justify-between border-b border-[var(--border-safe)] bg-[var(--bg-protected-header)] px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full bg-[var(--text-safe)]"
                  aria-hidden="true"
                />
                <span className="font-display text-xs font-medium text-[var(--text-primary)]">
                  Sanitized
                </span>
                <span className="rounded border border-[var(--border-safe)] bg-[#34d399]/10 px-1.5 py-0.5 font-mono text-xs text-[var(--text-safe)]">
                  Protected output
                </span>
              </div>
              <span className="font-mono text-xs tabular-nums text-[var(--text-secondary)]">
                {result.totalEntities} redacted
              </span>
            </div>

            {rawInput ? (
              <div
                ref={rightScrollRef}
                onScroll={() => handleSyncScroll('right')}
                aria-label="Sanitized output diff preview"
                className="custom-scrollbar h-64 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-[13px] leading-relaxed text-[var(--text-primary)] sm:h-80"
              >
                {renderHighlightedSegments(
                  result.sanitizedSegments,
                  'sanitized',
                  activeSelectedEntity?.id ?? null,
                  setSelectedEntity
                )}
              </div>
            ) : (
              <div
                aria-label="Sanitized output diff preview"
                className="flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center sm:min-h-80"
              >
                <div className="surface-active flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border-safe)] bg-[var(--bg-protected-well)]">
                  <ShieldCheck
                    size={20}
                    strokeWidth={1.6}
                    className="text-[var(--text-safe)]"
                    aria-hidden="true"
                  />
                </div>
                <div className="space-y-1">
                  <p className="font-display text-sm font-medium text-[var(--text-primary)]">
                    Paste text or upload a file
                  </p>
                  <p className="max-w-sm text-xs text-[var(--text-secondary)]">
                    Inspect sensitive prompts, logs, or CSVs and verify
                    sanitized output locally before sharing with an AI tool.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => onLoadSample(SAMPLE_DATASETS[0])}
                    className="transition-ui inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--accent-solid)] px-3.5 text-xs font-medium text-[var(--accent-solid-text)] hover:bg-[var(--accent-solid-hover)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-solid)]"
                  >
                    <FileText size={16} strokeWidth={1.5} aria-hidden="true" />
                    <span>Load fictional sample</span>
                  </button>
                  <button
                    type="button"
                    onClick={onRequestUpload}
                    className="transition-ui inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-panel)] px-3 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--border-accent)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-solid)]"
                  >
                    <Upload size={16} strokeWidth={1.5} aria-hidden="true" />
                    <span>Upload .txt / .csv</span>
                  </button>
                </div>
                <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5 border-t border-[var(--border-subtle)] pt-3">
                  <span className="text-[11px] text-[var(--text-muted)]">
                    Quick presets:
                  </span>
                  {SAMPLE_DATASETS.slice(1).map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => onLoadSample(preset)}
                      title={preset.description}
                      className="transition-ui rounded-md border border-[var(--border-subtle)] bg-[var(--bg-recessed)] px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:border-[var(--border-accent)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-solid)]"
                    >
                      {preset.name.replace(' (fictional)', '')}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-[var(--border-safe)] bg-[var(--bg-protected-header)] px-4 py-1.5 font-mono text-xs tabular-nums text-[var(--text-muted)]">
              <span>{result.sanitizedText.length} sanitized chars</span>
              <span>Click any badge to inspect</span>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
