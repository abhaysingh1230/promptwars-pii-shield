import { type RefObject } from 'react'
import { BookOpen, Shield, ShieldCheck } from 'lucide-react'
import type { RedactionMode } from '../engine/types'

interface HeaderProps {
  onOpenPromptLog: (initialTab: 'security' | 'prompts') => void
  promptLogTriggerRef: RefObject<HTMLButtonElement | null>
  securityModalTriggerRef: RefObject<HTMLButtonElement | null>
  onDeviceAiStatus: 'available' | 'unavailable'
  totalEntities: number
  mode: RedactionMode
  processingMs: number
}

const MODE_LABELS: Record<RedactionMode, string> = {
  full: 'Full mask',
  partial: 'Partial mask',
  pseudonym: 'Pseudonymization',
}

export function Header({
  onOpenPromptLog,
  promptLogTriggerRef,
  securityModalTriggerRef,
  onDeviceAiStatus,
  totalEntities,
  mode,
  processingMs,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#e2e8f0]/[0.08] bg-[#080a0f]/95 backdrop-blur-sm">
      <div className="mx-auto flex min-h-16 max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#22d3ee]/35 bg-[#111622] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <Shield
              size={16}
              strokeWidth={1.5}
              className="text-[#22d3ee]"
              aria-hidden="true"
            />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-display text-lg font-medium leading-none text-[#f1f5f9]">
                PII Shield
              </h1>
              <span className="hidden rounded border border-[#e2e8f0]/[0.08] bg-[#111622] px-1.5 py-0.5 font-mono text-xs text-[#8b93a7] sm:inline">
                v2.6
              </span>
            </div>
            <p className="mt-0.5 hidden text-xs text-[#8b93a7] sm:block">
              Local browser sanitization console for logs, tickets, resumes, and CSVs
            </p>
          </div>
        </div>

        {/* Live Instrument Readout + Documentation Triggers */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div
            aria-label="Live workstation status"
            className="hidden items-center gap-2.5 rounded-lg border border-[#e2e8f0]/[0.08] bg-[#0c1018] px-3 py-1.5 font-mono text-xs tabular-nums text-[#a3a9b8] lg:inline-flex"
            title="Text and file processing executes locally in browser memory."
          >
            <span
              className="h-1.5 w-1.5 rounded-full bg-[#34d399]"
              aria-hidden="true"
            />
            <span className="text-[#e2e8f0]">Processed in this browser</span>
            <span className="text-[#475569]">|</span>
            <span>{totalEntities} detected</span>
            <span className="text-[#475569]">|</span>
            <span className="text-[#22d3ee]">{MODE_LABELS[mode]}</span>
            <span className="text-[#475569]">|</span>
            <span className="text-[#8b93a7]">{processingMs} ms</span>
            {onDeviceAiStatus === 'available' && (
              <>
                <span className="text-[#475569]">|</span>
                <span className="text-[#8b93a7]">Gemini Nano</span>
              </>
            )}
          </div>

          <button
            ref={securityModalTriggerRef}
            type="button"
            onClick={() => onOpenPromptLog('security')}
            className="transition-ui inline-flex h-9 items-center gap-2 rounded-lg border border-[#e2e8f0]/[0.1] bg-[#111622] px-3 text-xs font-medium text-[#e2e8f0] hover:border-[#22d3ee]/50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee]"
          >
            <ShieldCheck
              size={16}
              strokeWidth={1.5}
              className="text-[#94a3b8]"
              aria-hidden="true"
            />
            <span>Security &amp; limits</span>
          </button>

          <button
            ref={promptLogTriggerRef}
            type="button"
            onClick={() => onOpenPromptLog('prompts')}
            className="transition-ui inline-flex h-9 items-center gap-2 rounded-lg border border-[#e2e8f0]/[0.1] bg-[#111622] px-3 text-xs font-medium text-[#e2e8f0] hover:border-[#22d3ee]/50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee]"
          >
            <BookOpen
              size={16}
              strokeWidth={1.5}
              className="text-[#94a3b8]"
              aria-hidden="true"
            />
            <span>Prompt log</span>
          </button>
        </div>
      </div>
    </header>
  )
}
