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
      className="space-y-3 rounded-xl border border-[#eef0f5]/[0.08] bg-[#0f131b] p-3.5 sm:p-4"
    >
      {/* Compact Top Workflow Toolbar */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        {/* Redaction Mode Cards */}
        <div className="space-y-1.5 xl:min-w-[440px]">
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
                  className="h-3.5 w-3.5 rounded border-[#eef0f5]/20 bg-[#090b10] accent-[#22d3ee]"
                />
                <span>Include type tags</span>
              </label>
            )}
          </div>

          <div
            role="group"
            aria-label="Redaction mode selection"
            className="grid grid-cols-1 gap-1.5 sm:grid-cols-3"
          >
            {MODE_OPTIONS.map((opt) => {
              const active = mode === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onModeChange(opt.id)}
                  className={`transition-ui flex min-h-11 flex-col items-start justify-center rounded-lg border px-3 py-1.5 text-left active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee] ${
                    active
                      ? 'surface-active border-[#22d3ee] bg-[#161b26] text-[#eef0f5]'
                      : 'border-[#eef0f5]/[0.08] bg-[#090b10] text-[#a3a9b8] hover:border-[#eef0f5]/20 hover:text-[#eef0f5]'
                  }`}
                >
                  <span className="text-xs font-medium leading-tight">
                    {opt.label}
                  </span>
                  <span className="mt-0.5 font-mono text-xs text-[#7a8296]">
                    {opt.example}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* File Upload, Fictional Sample, Clear, Download & Detection Settings */}
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
                ? 'border-[#22d3ee] bg-[#161b26]'
                : 'border-[#eef0f5]/[0.12] bg-[#090b10]'
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
              className="transition-ui inline-flex h-8 items-center gap-1.5 rounded-md bg-[#161b26] px-2.5 text-xs font-medium text-[#eef0f5] border border-[#eef0f5]/[0.1] hover:border-[#22d3ee]/50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee]"
            >
              <Upload size={16} strokeWidth={1.5} aria-hidden="true" />
              <span>Upload .txt / .csv</span>
            </button>

            <button
              type="button"
              onClick={() => onLoadSample(SAMPLE_DATASETS[0])}
              className="transition-ui inline-flex h-8 items-center gap-1.5 rounded-md border border-[#eef0f5]/[0.1] bg-[#161b26] px-2.5 text-xs font-medium text-[#eef0f5] hover:border-[#22d3ee]/50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee]"
            >
              <FileText size={16} strokeWidth={1.5} aria-hidden="true" />
              <span>Load fictional sample</span>
            </button>

            <button
              type="button"
              onClick={onClear}
              aria-label="Clear input text"
              className="transition-ui inline-flex h-8 items-center gap-1.5 rounded-md border border-[#eef0f5]/[0.08] bg-[#0f131b] px-2.5 text-xs font-medium text-[#a3a9b8] hover:text-[#eef0f5] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee]"
            >
              <Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />
              <span>Clear</span>
            </button>

            <button
              type="button"
              onClick={onDownloadSanitized}
              disabled={!canDownload}
              aria-label={`Toolbar download ${downloadFileName}`}
              className="transition-ui inline-flex h-8 items-center gap-1.5 rounded-md bg-[#eef0f5] px-3 text-xs font-medium text-[#090b10] hover:bg-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee]"
            >
              <Download size={16} strokeWidth={1.5} aria-hidden="true" />
              <span>Download</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {activeFileName && (
              <span className="font-mono text-xs text-[#a3a9b8]">
                Active: {activeFileName}
              </span>
            )}

            <button
              type="button"
              aria-expanded={settingsOpen}
              aria-controls="detection-settings-panel"
              onClick={() => setSettingsOpen((o) => !o)}
              className="transition-ui inline-flex h-8 items-center gap-1.5 rounded-md border border-[#eef0f5]/[0.08] bg-[#161b26] px-2.5 text-xs font-medium text-[#a3a9b8] hover:text-[#eef0f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee]"
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
          className="rounded-lg border border-[#e5484d]/50 bg-[#e5484d]/10 px-3 py-2 text-xs text-[#eef0f5]"
        >
          {uploadError}
        </div>
      )}

      {/* Collapsible Detection Settings + Fictional Presets */}
      {settingsOpen && (
        <div
          id="detection-settings-panel"
          className="space-y-3 border-t border-[#eef0f5]/[0.08] pt-3"
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
                        : 'border-[#eef0f5]/[0.06] bg-[#090b10] text-[#7a8296] line-through opacity-60'
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
                        ? 'surface-active border-[#22d3ee]/60 bg-[#161b26] text-[#eef0f5]'
                        : 'border-[#eef0f5]/[0.08] bg-[#090b10] text-[#a3a9b8] hover:border-[#eef0f5]/20 hover:text-[#eef0f5]'
                    }`}
                  >
                    <FileText
                      size={16}
                      strokeWidth={1.5}
                      className="text-[#7a8296]"
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
