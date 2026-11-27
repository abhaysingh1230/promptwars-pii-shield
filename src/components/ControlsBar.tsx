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
      className="instrument-panel space-y-3 rounded-xl border border-[#e2e8f0]/[0.08] p-4"
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        {/* Segmented Redaction Mode Selector */}
        <div className="space-y-1.5 xl:min-w-[470px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#a3a9b8]">
              Redaction mode
            </span>
            {mode === 'full' && (
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-[#a3a9b8]">
                <input
                  type="checkbox"
                  checked={fullMaskStyle === 'typed'}
                  onChange={(e) =>
                    onFullMaskStyleChange(
                      e.target.checked ? 'typed' : 'generic'
                    )
                  }
                  className="h-3.5 w-3.5 rounded border-[#e2e8f0]/20 bg-[#080a0f] accent-[#22d3ee]"
                />
                <span>Include type tags</span>
              </label>
            )}
          </div>

          <div
            role="group"
            aria-label="Redaction mode selection"
            className="instrument-recessed grid grid-cols-1 gap-1.5 rounded-lg border border-[#e2e8f0]/[0.07] p-1 sm:grid-cols-3"
          >
            {MODE_OPTIONS.map((opt) => {
              const active = mode === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onModeChange(opt.id)}
                  className={`transition-ui relative flex min-h-11 flex-col items-start justify-center rounded-md border px-3 py-1.5 text-left active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee] ${
                    active
                      ? 'surface-active border-[#22d3ee]/60 bg-[#171f2e] text-[#f1f5f9]'
                      : 'border-transparent bg-transparent text-[#94a3b8] hover:bg-[#111622] hover:text-[#e2e8f0]'
                  }`}
                >
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-3 top-0 h-[1.5px] rounded-full bg-[#22d3ee]"
                    />
                  )}
                  <span className="text-xs font-medium leading-tight">
                    {opt.label}
                  </span>
                  <span className="mt-0.5 font-mono text-xs text-[#8b93a7]">
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
                ? 'border-[#22d3ee] bg-[#161e2b]'
                : 'border-[#e2e8f0]/[0.12] bg-[#090c12]'
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
              className="transition-ui inline-flex h-9 items-center gap-1.5 rounded-md border border-[#e2e8f0]/[0.1] bg-[#151b26] px-3 text-xs font-medium text-[#f1f5f9] hover:border-[#22d3ee]/50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee]"
            >
              <Upload size={16} strokeWidth={1.5} aria-hidden="true" />
              <span>Upload .txt / .csv</span>
            </button>

            <button
              type="button"
              onClick={() => onLoadSample(SAMPLE_DATASETS[0])}
              className="transition-ui inline-flex h-9 items-center gap-1.5 rounded-md border border-[#e2e8f0]/[0.1] bg-[#151b26] px-3 text-xs font-medium text-[#f1f5f9] hover:border-[#22d3ee]/50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee]"
            >
              <FileText size={16} strokeWidth={1.5} aria-hidden="true" />
              <span>Load fictional sample</span>
            </button>

            <button
              type="button"
              onClick={onClear}
              aria-label="Clear input text"
              className="transition-ui inline-flex h-9 items-center gap-1.5 rounded-md border border-[#e2e8f0]/[0.08] bg-[#0d1119] px-2.5 text-xs font-medium text-[#94a3b8] hover:text-[#f1f5f9] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee]"
            >
              <Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />
              <span>Clear</span>
            </button>

            <button
              type="button"
              onClick={onDownloadSanitized}
              disabled={!canDownload}
              aria-label={`Toolbar download ${downloadFileName}`}
              className="transition-ui inline-flex h-9 items-center gap-1.5 rounded-md bg-[#22d3ee] px-3.5 text-xs font-medium text-[#080a0f] hover:bg-[#38e1fa] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#1a2230] disabled:text-[#64748b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f1f5f9]"
            >
              <Download size={16} strokeWidth={1.5} aria-hidden="true" />
              <span>Download</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {activeFileName && (
              <span className="font-mono text-xs text-[#94a3b8]">
                Active: {activeFileName}
              </span>
            )}

            <button
              type="button"
              aria-expanded={settingsOpen}
              aria-controls="detection-settings-panel"
              onClick={() => setSettingsOpen((o) => !o)}
              className="transition-ui inline-flex h-8 items-center gap-1.5 rounded-md border border-[#e2e8f0]/[0.08] bg-[#121824] px-2.5 text-xs font-medium text-[#cbd5e1] hover:border-[#22d3ee]/40 hover:text-[#f1f5f9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee]"
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
          className="rounded-lg border border-[#e5484d]/50 bg-[#e5484d]/10 px-3 py-2 text-xs text-[#f1f5f9]"
        >
          {uploadError}
        </div>
      )}

      {/* Collapsible Detection Settings */}
      {settingsOpen && (
        <div
          id="detection-settings-panel"
          className="space-y-3 border-t border-[#e2e8f0]/[0.08] pt-3"
        >
          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-[#a3a9b8]">
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
                    className={`transition-ui inline-flex h-8 items-center gap-2 rounded-lg border px-2.5 text-xs font-medium active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee] ${
                      enabled
                        ? meta.badgeClass
                        : 'border-[#e2e8f0]/[0.06] bg-[#090c12] text-[#8b93a7] line-through opacity-75'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`}
                      aria-hidden="true"
                    />
                    <span>{meta.label}</span>
                    <span className="font-mono text-xs tabular-nums text-[#a3a9b8]">
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-[#a3a9b8]">
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
                    className={`transition-ui inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee] ${
                      isLoaded
                        ? 'surface-active border-[#22d3ee]/60 bg-[#171f2e] text-[#f1f5f9]'
                        : 'border-[#e2e8f0]/[0.08] bg-[#090c12] text-[#a3a9b8] hover:border-[#e2e8f0]/20 hover:text-[#f1f5f9]'
                    }`}
                  >
                    <FileText
                      size={16}
                      strokeWidth={1.5}
                      className="text-[#8b93a7]"
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
