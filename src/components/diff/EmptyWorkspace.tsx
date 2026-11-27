import { FileText, ShieldCheck, Upload } from 'lucide-react'
import { SAMPLE_DATASETS, type SampleDataset } from '../../data/samples'

interface EmptyWorkspaceProps {
  onLoadSample: (sample: SampleDataset) => void
  onRequestUpload: () => void
}

/**
 * Clean initial state inside the Sanitized pane with one-click fictional presets and file upload.
 */
export function EmptyWorkspace({
  onLoadSample,
  onRequestUpload,
}: EmptyWorkspaceProps) {
  return (
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
          Inspect sensitive prompts, logs, or CSVs and verify sanitized output
          locally before sharing with an AI tool.
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
  )
}
