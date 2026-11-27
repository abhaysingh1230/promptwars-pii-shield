import { useState } from 'react'
import { Check, Copy, Download, Eye, FileCode2 } from 'lucide-react'
import {
  PII_CATEGORY_META,
  type DiffSegment,
  type SanitizeResult,
} from '../engine/types'

interface DiffViewerProps {
  rawInput: string
  onRawInputChange: (value: string) => void
  result: SanitizeResult
  downloadFileName: string
  onDownloadSanitized: () => void
}

function renderHighlightedSegments(
  segments: DiffSegment[],
  variant: 'original' | 'sanitized'
) {
  if (segments.length === 0) {
    return (
      <span className="text-slate-500">
        Paste text above or load a sample dataset to inspect live PII highlights...
      </span>
    )
  }

  return segments.map((seg, idx) => {
    if (seg.type === 'text' || !seg.entity) {
      return <span key={idx}>{seg.text}</span>
    }

    const meta = PII_CATEGORY_META[seg.entity.category]
    const tooltip = [
      meta.label,
      seg.entity.validationNote ? `(${seg.entity.validationNote})` : '',
      variant === 'original'
        ? `→ ${seg.entity.replacement}`
        : `← redacted`,
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <mark
        key={seg.entity.id + '-' + idx}
        title={tooltip}
        aria-label={tooltip}
        className={`rounded px-1 py-0.5 font-mono text-[13px] ${
          variant === 'original' ? meta.highlightClass : meta.redactedClass
        }`}
      >
        {seg.text}
      </mark>
    )
  })
}

export function DiffViewer({
  rawInput,
  onRawInputChange,
  result,
  downloadFileName,
  onDownloadSanitized,
}: DiffViewerProps) {
  const [copied, setCopied] = useState(false)
  const [leftTab, setLeftTab] = useState<'edit' | 'highlights'>('edit')

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(result.sanitizedText)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard may be unavailable in restricted test environments
    }
  }

  return (
    <section
      aria-labelledby="diff-heading"
      className="space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 id="diff-heading" className="text-sm font-semibold text-white">
            Live Side-by-Side Diff View
          </h2>
          {result.isCsv && (
            <span className="rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 font-mono text-[11px] text-blue-300">
              CSV Mode • {result.csvRowCount} rows × {result.csvColCount} cols
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            disabled={!result.sanitizedText}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                <span className="text-emerald-300">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                <span>Copy Output</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onDownloadSanitized}
            disabled={!result.sanitizedText}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Download {downloadFileName}</span>
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Left Pane: Original Input / Annotated Highlights */}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-4 py-2.5">
            <label
              htmlFor="raw-pii-input"
              className="text-xs font-semibold text-slate-200"
            >
              Original Input
            </label>
            <div
              role="tablist"
              aria-label="Original input view mode"
              className="inline-flex rounded-lg border border-slate-800 bg-slate-900 p-0.5"
            >
              <button
                type="button"
                role="tab"
                aria-selected={leftTab === 'edit'}
                onClick={() => setLeftTab('edit')}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                  leftTab === 'edit'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileCode2 className="h-3 w-3" aria-hidden="true" />
                <span>Edit Text</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={leftTab === 'highlights'}
                onClick={() => setLeftTab('highlights')}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                  leftTab === 'highlights'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Eye className="h-3 w-3" aria-hidden="true" />
                <span>PII Highlights ({result.totalEntities})</span>
              </button>
            </div>
          </div>

          {leftTab === 'edit' ? (
            <textarea
              id="raw-pii-input"
              value={rawInput}
              onChange={(e) => onRawInputChange(e.target.value)}
              placeholder="Paste raw logs, resumes, support tickets, clinical notes, or CSV rows here — everything stays 100% in your browser..."
              spellCheck={false}
              className="custom-scrollbar h-80 w-full resize-y bg-transparent p-4 font-mono text-[13px] leading-relaxed text-slate-100 placeholder:text-slate-500 focus:outline-none sm:h-96"
            />
          ) : (
            <div
              aria-label="Original text with detected PII highlighted"
              className="custom-scrollbar h-80 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-[13px] leading-relaxed text-slate-200 sm:h-96"
            >
              {renderHighlightedSegments(result.originalSegments, 'original')}
            </div>
          )}
        </div>

        {/* Right Pane: Sanitized Diff Output */}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-4 py-2.5">
            <span className="text-xs font-semibold text-emerald-300">
              Sanitized Output (Live Preview)
            </span>
            <span
              aria-live="polite"
              className="font-mono text-[11px] text-slate-400"
            >
              {result.totalEntities} redacted in {result.processingMs} ms
            </span>
          </div>

          <div
            aria-label="Sanitized output diff preview"
            className="custom-scrollbar h-80 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-[13px] leading-relaxed text-slate-100 sm:h-96"
          >
            {renderHighlightedSegments(result.sanitizedSegments, 'sanitized')}
          </div>
        </div>
      </div>
    </section>
  )
}
