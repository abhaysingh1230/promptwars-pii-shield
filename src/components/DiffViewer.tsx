import { useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowRight,
  Check,
  Copy,
  Download,
  Eye,
  FileCode2,
  Link2,
  Table2,
} from 'lucide-react'
import type { SampleDataset } from '../data/samples'
import { parseCsv } from '../engine/csv'
import {
  BUILTIN_CATEGORIES,
  PII_CATEGORY_META,
  type PiiEntity,
  type RedactionMode,
  type SanitizeResult,
} from '../engine/types'
import { handleRovingTabKeyDown } from '../hooks/useRovingTabs'
import { CsvTableView } from './diff/CsvTableView'
import { EmptyWorkspace } from './diff/EmptyWorkspace'
import { EntityInspector } from './diff/EntityInspector'
import { HighlightedSegments } from './diff/HighlightedSegments'
import { isVerifiedEntity } from './diff/entityConfidence'

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

type LeftPaneTab = 'edit' | 'highlights'
const LEFT_TAB_ORDER: readonly LeftPaneTab[] = ['edit', 'highlights']

const MODE_SHORT_LABEL: Record<RedactionMode, string> = {
  full: 'Full mask',
  partial: 'Partial mask',
  pseudonym: 'Pseudonym',
}

/**
 * Connected side-by-side Original -> Sanitized workspace with interactive highlight
 * inspection, synchronized scroll, CSV table diff, and accessible live feedback.
 */
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
  const [leftTab, setLeftTab] = useState<LeftPaneTab>('edit')
  const [viewMode, setViewMode] = useState<'text' | 'table'>('text')
  const [syncScroll, setSyncScroll] = useState(true)
  const [selectedEntity, setSelectedEntity] = useState<PiiEntity | null>(null)

  const leftScrollRef = useRef<HTMLDivElement>(null)
  const rightScrollRef = useRef<HTMLDivElement>(null)
  const leftTabRefs = useRef<Record<LeftPaneTab, HTMLButtonElement | null>>({
    edit: null,
    highlights: null,
  })
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

  const effectiveViewMode =
    result.isCsv && !result.csvParseError ? viewMode : 'text'
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
  const sweepKey = `${mode}:${rawInput.length}:${result.totalEntities}`

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
      // Clipboard may be unavailable in restricted environments
    }
  }

  function handleDownloadClick() {
    onDownloadSanitized()
    setDownloadAnnouncement(`Downloaded ${downloadFileName}`)
    setTimeout(() => setDownloadAnnouncement(''), 2500)
  }

  const liveStatusText = isProcessing
    ? 'Scanning in background worker...'
    : downloadAnnouncement ||
      (copied
        ? 'Copied sanitized output to clipboard'
        : result.totalEntities > 0
          ? `${result.totalEntities} entities (${verifiedCount} verified · ${formatOnlyCount} format-only) · ${MODE_SHORT_LABEL[mode]} · ${result.processingMs} ms`
          : `0 entities · ${MODE_SHORT_LABEL[mode]} · ${result.processingMs} ms`)

  return (
    <section aria-labelledby="diff-heading" className="space-y-3">
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
              {(
                [
                  { id: 'text', label: 'Raw diff', icon: FileCode2 },
                  { id: 'table', label: 'Table diff', icon: Table2 },
                ] as const
              ).map((item) => {
                const Icon = item.icon
                const active = effectiveViewMode === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setViewMode(item.id)}
                    className={`transition-ui inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium ${
                      active
                        ? 'surface-active bg-[var(--bg-active)] text-[var(--text-primary)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
                    <span>{item.label}</span>
                  </button>
                )
              })}
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
          {liveStatusText}
        </div>
      </div>

      {result.csvParseError && (
        <div
          role="alert"
          className="rounded-lg border border-[#e5484d]/50 bg-[#e5484d]/10 px-3.5 py-2.5 text-xs text-[var(--text-primary)]"
        >
          <span className="font-medium">CSV parsing error: </span>
          <span>{result.csvParseError}</span>
        </div>
      )}

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

      {activeSelectedEntity && (
        <EntityInspector
          entity={activeSelectedEntity}
          onDismiss={() => setSelectedEntity(null)}
        />
      )}

      {isProcessing && (
        <div
          aria-hidden="true"
          className="relative h-0.5 w-full overflow-hidden rounded-full bg-[var(--border-subtle)]"
        >
          <div className="processing-scan-line h-full bg-gradient-to-r from-transparent via-[var(--text-accent)] to-transparent" />
        </div>
      )}

      {effectiveViewMode === 'table' && csvTables ? (
        <CsvTableView
          originalRows={csvTables.originalRows}
          sanitizedRows={csvTables.sanitizedRows}
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-[1fr_28px_1fr] lg:items-stretch lg:gap-0">
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
                {(
                  [
                    { id: 'edit', label: 'Edit', icon: FileCode2 },
                    {
                      id: 'highlights',
                      label: `Highlights (${result.totalEntities})`,
                      icon: Eye,
                    },
                  ] as const
                ).map((tab) => {
                  const Icon = tab.icon
                  const active = leftTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      ref={(el) => {
                        leftTabRefs.current[tab.id] = el
                      }}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      tabIndex={active ? 0 : -1}
                      onClick={() => setLeftTab(tab.id)}
                      onKeyDown={(e) =>
                        handleRovingTabKeyDown(
                          e,
                          tab.id,
                          LEFT_TAB_ORDER,
                          setLeftTab,
                          leftTabRefs
                        )
                      }
                      className={`transition-ui inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-solid)] ${
                        active
                          ? 'surface-active bg-[var(--bg-active)] text-[var(--text-primary)]'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
                      <span>{tab.label}</span>
                    </button>
                  )
                })}
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
                  <HighlightedSegments
                    segments={result.originalSegments}
                    variant="original"
                    selectedId={activeSelectedEntity?.id ?? null}
                    onSelectEntity={setSelectedEntity}
                  />
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

          <div className="protected-panel relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--border-safe)]">
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute right-2 top-2 h-3 w-3 text-[var(--text-safe)] opacity-45"
              viewBox="0 0 12 12"
              fill="none"
            >
              <path d="M2 1H11V10" stroke="currentColor" strokeWidth="1.25" />
            </svg>

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
                <HighlightedSegments
                  segments={result.sanitizedSegments}
                  variant="sanitized"
                  selectedId={activeSelectedEntity?.id ?? null}
                  onSelectEntity={setSelectedEntity}
                />
              </div>
            ) : (
              <EmptyWorkspace
                onLoadSample={onLoadSample}
                onRequestUpload={onRequestUpload}
              />
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
