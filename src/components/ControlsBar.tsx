import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  SlidersHorizontal,
  Trash2,
  Upload,
} from 'lucide-react'
import { SAMPLE_DATASETS, type SampleDataset } from '../data/samples'
import {
  ALL_CATEGORIES,
  PII_CATEGORY_META,
  type FullMaskStyle,
  type PiiCategory,
  type RedactionMode,
} from '../engine/types'

interface ControlsBarProps {
  mode: RedactionMode
  onModeChange: (mode: RedactionMode) => void
  fullMaskStyle: FullMaskStyle
  onFullMaskStyleChange: (style: FullMaskStyle) => void
  enabledCategories: Record<PiiCategory, boolean>
  onToggleCategory: (category: PiiCategory) => void
  countsByCategory: Record<PiiCategory, number>
  onLoadSample: (sample: SampleDataset) => void
  onUploadFile: (file: File) => void
  onClear: () => void
  onDownloadSanitized: () => void
  canDownload: boolean
  downloadFileName: string
  activeFileName: string | null
  uploadError: string | null
}

const MODE_OPTIONS: ReadonlyArray<{
  id: RedactionMode
  label: string
  example: string
}> = [
  { id: 'full', label: 'Full mask', example: '[REDACTED]' },
  { id: 'partial', label: 'Partial mask', example: 'XXXX-XXXX-1234' },
  { id: 'pseudonym', label: 'Pseudonymization', example: 'EMAIL_01' },
]

export function ControlsBar({
  mode,
  onModeChange,
  fullMaskStyle,
  onFullMaskStyleChange,
  enabledCategories,
  onToggleCategory,
  countsByCategory,
  onLoadSample,
  onUploadFile,
  onClear,
  onDownloadSanitized,
  canDownload,
  downloadFileName,
  activeFileName,
  uploadError,
}: ControlsBarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const activeDetectorCount = ALL_CATEGORIES.filter(
    (c) => enabledCategories[c]
  ).length

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      onUploadFile(file)
    }
    e.target.value = ''
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      onUploadFile(file)
    }
  }

  return (
    <section
      aria-label="Sanitization Controls and Sample Loader"
      className="instrument-panel space-y-3 rounded-xl border border-[var(--border-subtle)] p-4"
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        {/* Segmented Redaction Mode Selector */}
        <div className="space-y-1.5 xl:min-w-[470px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[var(--text-secondary)]">
              Redaction mode
            </span>
            {mode === 'full' && (
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={fullMaskStyle === 'typed'}
                  onChange={(e) =>
                    onFullMaskStyleChange(
                      e.target.checked ? 'typed' : 'generic'
                    )
                  }
                  className="h-3.5 w-3.5 rounded border-[var(--border-strong)] bg-[var(--bg-recessed)] accent-[var(--accent-solid)]"
                />
                <span>Include type tags</span>
              </label>
            )}
          </div>

          <div
            role="group"
            aria-label="Redaction mode selection"
            className="instrument-recessed grid grid-cols-1 gap-1.5 rounded-lg border border-[var(--border-subtle)] p-1 sm:grid-cols-3"
          >
            {MODE_OPTIONS.map((opt) => {
              const active = mode === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onModeChange(opt.id)}
                  className={`transition-ui relative flex min-h-11 flex-col items-start justify-center rounded-md border px-3 py-1.5 text-left active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-solid)] ${
                    active
                      ? 'surface-active border-[var(--border-accent)] bg-[var(--bg-active)] text-[var(--text-primary)]'
                      : 'border-transparent bg-transparent text-[var(--text-muted)] hover:bg-[var(--bg-panel)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-3 top-0 h-[1.5px] rounded-full bg-[var(--accent-solid)]"
                    />
                  )}
                  <span className="text-xs font-medium leading-tight">
                    {opt.label}
                  </span>
                  <span className="mt-0.5 font-mono text-xs text-[var(--text-muted)]">
                    {opt.example}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Primary Workflow Actions */}
        <div className="flex flex-col gap-2 sm:items-end">
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`transition-ui flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-1.5 ${
              isDragging
                ? 'border-[var(--accent-solid)] bg-[var(--bg-drag)]'
                : 'border-[var(--border-strong)] bg-[var(--bg-recessed)]'
            }`}
          >
            <input
              ref={fileInputRef}
              id="pii-file-upload"
              type="file"
              accept=".txt,.csv,text/plain,text/csv"
              onChange={handleFileChange}
              className="sr-only"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="transition-ui inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--border-strong)] bg-[var(--bg-panel)] px-3 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--border-accent)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-solid)]"
            >
              <Upload size={16} strokeWidth={1.5} aria-hidden="true" />
              <span>Upload .txt / .csv</span>
            </button>

            <button
              type="button"
              onClick={() => onLoadSample(SAMPLE_DATASETS[0])}
              className="transition-ui inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--border-strong)] bg-[var(--bg-panel)] px-3 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--border-accent)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-solid)]"
            >
              <FileText size={16} strokeWidth={1.5} aria-hidden="true" />
              <span>Load fictional sample</span>
            </button>

            <button
              type="button"
              onClick={onClear}
              aria-label="Clear input text"
              className="transition-ui inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-panel-hover)] px-2.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-solid)]"
            >
              <Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />
              <span>Clear</span>
            </button>

            <button
              type="button"
              onClick={onDownloadSanitized}
              disabled={!canDownload}
              aria-label={`Toolbar download ${downloadFileName}`}
              className="transition-ui inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--accent-solid)] px-3.5 text-xs font-medium text-[var(--accent-solid-text)] hover:bg-[var(--accent-solid-hover)] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[var(--bg-disabled)] disabled:text-[var(--text-disabled)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-primary)]"
            >
              <Download size={16} strokeWidth={1.5} aria-hidden="true" />
              <span>Download</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {activeFileName && (
              <span className="font-mono text-xs text-[var(--text-muted)]">
                Active: {activeFileName}
              </span>
            )}

            <button
              type="button"
              aria-expanded={settingsOpen}
              aria-controls="detection-settings-panel"
              onClick={() => setSettingsOpen((o) => !o)}
              className="transition-ui inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-2.5 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--border-accent)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-solid)]"
            >
              <SlidersHorizontal size={16} strokeWidth={1.5} aria-hidden="true" />
              <span>
                Detection settings ({activeDetectorCount}/{ALL_CATEGORIES.length})
              </span>
              {settingsOpen ? (
                <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" />
              ) : (
                <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {uploadError && (
        <div
          role="alert"
          className="rounded-lg border border-[#e5484d]/50 bg-[#e5484d]/10 px-3 py-2 text-xs text-[var(--text-primary)]"
        >
          {uploadError}
        </div>
      )}

      {/* Collapsible Detection Settings */}
      {settingsOpen && (
        <div
          id="detection-settings-panel"
          className="space-y-3 border-t border-[var(--border-subtle)] pt-3"
        >
          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-[var(--text-secondary)]">
              Active PII detectors
            </span>
            <div className="flex flex-wrap gap-1.5">
              {ALL_CATEGORIES.map((cat) => {
                const meta = PII_CATEGORY_META[cat]
                const enabled = enabledCategories[cat]
                const count = countsByCategory[cat]
                return (
                  <button
                    key={cat}
                    type="button"
                    aria-pressed={enabled}
                    onClick={() => onToggleCategory(cat)}
                    title={meta.description}
                    className={`transition-ui inline-flex h-8 items-center gap-2 rounded-lg border px-2.5 text-xs font-medium active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-solid)] ${
                      enabled
                        ? meta.badgeClass
                        : 'border-[var(--border-subtle)] bg-[var(--bg-recessed)] text-[var(--text-muted)] line-through opacity-75'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`}
                      aria-hidden="true"
                    />
                    <span>{meta.label}</span>
                    <span className="font-mono text-xs tabular-nums text-[var(--text-secondary)]">
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-[var(--text-secondary)]">
              Fictional sample presets
            </span>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_DATASETS.map((sample) => {
                const isLoaded =
                  activeFileName === `${sample.id}.${sample.format}`
                return (
                  <button
                    key={sample.id}
                    type="button"
                    onClick={() => onLoadSample(sample)}
                    title={sample.description}
                    className={`transition-ui inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-solid)] ${
                      isLoaded
                        ? 'surface-active border-[var(--border-accent)] bg-[var(--bg-active)] text-[var(--text-primary)]'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-recessed)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <FileText
                      size={16}
                      strokeWidth={1.5}
                      className="text-[var(--text-muted)]"
                      aria-hidden="true"
                    />
                    <span>{sample.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
