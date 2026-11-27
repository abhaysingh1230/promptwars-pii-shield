import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { FileText, Sparkles, Trash2, Upload } from 'lucide-react'
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
  {
    id: 'full',
    label: 'Full Mask',
    hint: '[REDACTED]',
  },
  {
    id: 'partial',
    label: 'Partial Mask',
    hint: 'XXXX-XXXX-1234',
  },
  {
    id: 'pseudonym',
    label: 'Consistent Pseudonym',
    hint: 'EMAIL_01 / CARD_01',
  },
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
      className="space-y-3.5 rounded-2xl border border-slate-800/90 bg-slate-900/65 p-4 ring-1 ring-white/[0.03] backdrop-blur sm:p-5"
    >
      {/* Top Row: Sample Loader + File Upload */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
            <span>1-Click Sample Noisy Datasets</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SAMPLE_DATASETS.map((sample) => {
              const isLoaded = activeFileName === `${sample.id}.${sample.format}`
              return (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => onLoadSample(sample)}
                  title={sample.description}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                    isLoaded
                      ? 'border-cyan-400/70 bg-cyan-500/15 text-cyan-200'
                      : 'border-slate-700/80 bg-slate-950/80 text-slate-200 hover:border-cyan-500/50 hover:bg-slate-800/80'
                  }`}
                >
                  <FileText className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
                  <span>{sample.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`flex flex-wrap items-center gap-2 rounded-xl border border-dashed px-3 py-2 transition ${
            isDragging
              ? 'border-cyan-400 bg-cyan-500/10'
              : 'border-slate-700/90 bg-slate-950/60'
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
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-400 to-sky-400 px-3 py-1.5 text-xs font-semibold text-slate-950 shadow-sm shadow-cyan-500/20 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Upload .txt / .csv</span>
          </button>

          <span className="text-xs text-slate-400">
            {activeFileName ? (
              <span className="font-mono text-cyan-300">{activeFileName}</span>
            ) : (
              'or drop file (max 5 MB)'
            )}
          </span>

          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700/90 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:border-rose-500/50 hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
            aria-label="Clear input text"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {uploadError && (
        <div
          role="alert"
          className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200"
        >
          {uploadError}
        </div>
      )}

      {/* Bottom Row: Redaction Modes + Category Toggles */}
      <div className="grid gap-3.5 border-t border-slate-800/80 pt-3.5 lg:grid-cols-12">
        <div className="space-y-1.5 lg:col-span-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Redaction Mode
            </span>
            {mode === 'full' && (
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={fullMaskStyle === 'typed'}
                  onChange={(e) =>
                    onFullMaskStyleChange(
                      e.target.checked ? 'typed' : 'generic'
                    )
                  }
                  className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-400"
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
                  className={`flex flex-col items-start rounded-xl border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                    active
                      ? 'border-cyan-400/80 bg-cyan-500/15 text-white shadow-sm shadow-cyan-500/15'
                      : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <span className="text-xs font-semibold">{opt.label}</span>
                  <span className="mt-0.5 font-mono text-[10px] text-slate-400">
                    {opt.hint}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-1.5 lg:col-span-7">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Active PII Detectors (Click to Toggle)
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
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                    enabled
                      ? meta.badgeClass
                      : 'border-slate-800 bg-slate-950/50 text-slate-500 line-through'
                  }`}
                >
                  <span>{meta.label}</span>
                  <span
                    className={`rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold ${
                      enabled
                        ? 'bg-slate-950/70 text-white'
                        : 'bg-slate-900 text-slate-500'
                    }`}
                  >
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
