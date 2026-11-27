import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { FileText, Trash2, Upload } from 'lucide-react'
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
  activeFileName: string | null
  uploadError: string | null
}

const MODE_OPTIONS: ReadonlyArray<{
  id: RedactionMode
  label: string
  hint: string
}> = [
  { id: 'full', label: 'Full mask', hint: '[REDACTED]' },
  { id: 'partial', label: 'Partial mask', hint: 'XXXX-XXXX-1234' },
  { id: 'pseudonym', label: 'Consistent pseudonym', hint: 'EMAIL_01' },
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
  activeFileName,
  uploadError,
}: ControlsBarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

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
      className="space-y-3 rounded-xl border border-[#eef0f5]/[0.08] bg-[#11141c] p-4"
    >
      {/* Row 1: Sample presets + File upload */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-medium text-[#a3a9b8]">
            Sample datasets
          </span>
          {SAMPLE_DATASETS.map((sample) => {
            const isLoaded = activeFileName === `${sample.id}.${sample.format}`
            return (
              <button
                key={sample.id}
                type="button"
                onClick={() => onLoadSample(sample)}
                title={sample.description}
                className={`transition-unslop inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8] ${
                  isLoaded
                    ? 'surface-active border-[#38bdf8]/50 bg-[#1a1e28] text-[#eef0f5]'
                    : 'border-[#eef0f5]/[0.08] bg-[#0b0d14] text-[#a3a9b8] hover:border-[#eef0f5]/20 hover:text-[#eef0f5]'
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

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`transition-unslop flex flex-wrap items-center gap-2 rounded-lg border border-dashed px-3 py-1.5 ${
            isDragging
              ? 'border-[#38bdf8] bg-[#1a1e28]'
              : 'border-[#eef0f5]/[0.12] bg-[#0b0d14]'
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
            className="transition-unslop inline-flex h-8 items-center gap-2 rounded-md bg-[#eef0f5] px-3 text-xs font-medium text-[#0b0d14] hover:bg-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8]"
          >
            <Upload size={16} strokeWidth={1.5} aria-hidden="true" />
            <span>Upload .txt / .csv</span>
          </button>

          <span className="font-mono text-xs text-[#7a8296]">
            {activeFileName ?? 'Max 5 MB'}
          </span>

          <button
            type="button"
            onClick={onClear}
            aria-label="Clear input text"
            className="transition-unslop inline-flex h-8 items-center gap-1.5 rounded-md border border-[#eef0f5]/[0.08] bg-[#1a1e28] px-2.5 text-xs font-medium text-[#a3a9b8] hover:text-[#eef0f5] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8]"
          >
            <Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {uploadError && (
        <div
          role="alert"
          className="rounded-lg border border-[#e5484d]/40 bg-[#e5484d]/10 px-3 py-2 text-xs text-[#eef0f5]"
        >
          {uploadError}
        </div>
      )}

      {/* Row 2: Redaction mode + Active detectors */}
      <div className="grid gap-3 border-t border-[#eef0f5]/[0.08] pt-3 lg:grid-cols-12 lg:items-center">
        <div className="space-y-1.5 lg:col-span-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#a3a9b8]">
              Redaction mode
            </span>
            {mode === 'full' && (
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-[#a3a9b8]">
                <input
                  type="checkbox"
                  checked={fullMaskStyle === 'typed'}
                  onChange={(e) =>
                    onFullMaskStyleChange(
                      e.target.checked ? 'typed' : 'generic'
                    )
                  }
                  className="h-3.5 w-3.5 rounded border-[#eef0f5]/20 bg-[#0b0d14] accent-[#38bdf8]"
                />
                <span>Include type tags</span>
              </label>
            )}
          </div>

          <div
            role="group"
            aria-label="Redaction mode selection"
            className="grid grid-cols-3 gap-1.5"
          >
            {MODE_OPTIONS.map((opt) => {
              const active = mode === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onModeChange(opt.id)}
                  className={`transition-unslop flex min-h-9 flex-col items-start justify-center rounded-lg border px-2.5 py-1.5 text-left active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8] sm:min-h-10 sm:px-3 ${
                    active
                      ? 'surface-active border-[#38bdf8]/60 bg-[#1a1e28] text-[#eef0f5]'
                      : 'border-[#eef0f5]/[0.08] bg-[#0b0d14] text-[#a3a9b8] hover:border-[#eef0f5]/20 hover:text-[#eef0f5]'
                  }`}
                >
                  <span className="text-xs font-medium leading-tight">
                    {opt.label}
                  </span>
                  <span className="hidden font-mono text-xs text-[#7a8296] sm:inline">
                    {opt.hint}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-1.5 lg:col-span-7">
          <span className="block text-xs font-medium text-[#a3a9b8]">
            Active detectors
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
                  className={`transition-unslop inline-flex h-8 items-center gap-1.5 rounded-lg border px-2 text-xs font-medium active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8] sm:h-9 sm:gap-2 sm:px-2.5 ${
                    enabled
                      ? meta.badgeClass
                      : 'border-[#eef0f5]/[0.06] bg-[#0b0d14] text-[#7a8296] line-through opacity-60'
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
      </div>
    </section>
  )
}
