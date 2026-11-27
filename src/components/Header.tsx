import { type RefObject } from 'react'
import { BookOpen, Shield, ShieldCheck } from 'lucide-react'

interface HeaderProps {
  onOpenPromptLog: (initialTab: 'security' | 'prompts') => void
  promptLogTriggerRef: RefObject<HTMLButtonElement | null>
  securityModalTriggerRef: RefObject<HTMLButtonElement | null>
  onDeviceAiStatus: 'available' | 'unavailable'
}

export function Header({
  onOpenPromptLog,
  promptLogTriggerRef,
  securityModalTriggerRef,
  onDeviceAiStatus,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#eef0f5]/[0.08] bg-[#090b10]/95 backdrop-blur-sm">
      <div className="mx-auto flex min-h-14 max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#22d3ee]/30 bg-[#161b26]">
            <Shield
              size={16}
              strokeWidth={1.5}
              className="text-[#22d3ee]"
              aria-hidden="true"
            />
          </div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <h1 className="text-base font-medium leading-none text-[#eef0f5]">
              PII Shield
            </h1>
            <p className="hidden text-xs text-[#8b93a7] sm:inline">
              Client-side privacy workstation for logs, tickets, resumes, and CSVs
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div
            className="hidden items-center gap-2 font-mono text-xs tabular-nums text-[#a3a9b8] md:inline-flex"
            title="Text and file processing runs locally in browser memory. Static assets are served from this origin."
          >
            <span
              className="h-1.5 w-1.5 rounded-full bg-[#4cc38a]"
              aria-hidden="true"
            />
            <span>Processed in this browser</span>
            {onDeviceAiStatus === 'available' && (
              <span className="text-[#8b93a7]">· Gemini Nano ready</span>
            )}
          </div>

          <button
            ref={securityModalTriggerRef}
            type="button"
            onClick={() => onOpenPromptLog('security')}
            className="transition-ui inline-flex h-9 items-center gap-2 rounded-lg border border-[#eef0f5]/[0.1] bg-[#161b26] px-3 text-xs font-medium text-[#eef0f5] hover:border-[#22d3ee]/50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee]"
          >
            <ShieldCheck
              size={16}
              strokeWidth={1.5}
              className="text-[#a3a9b8]"
              aria-hidden="true"
            />
            <span>Security &amp; limits</span>
          </button>

          <button
            ref={promptLogTriggerRef}
            type="button"
            onClick={() => onOpenPromptLog('prompts')}
            className="transition-ui inline-flex h-9 items-center gap-2 rounded-lg border border-[#eef0f5]/[0.1] bg-[#161b26] px-3 text-xs font-medium text-[#eef0f5] hover:border-[#22d3ee]/50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee]"
          >
            <BookOpen
              size={16}
              strokeWidth={1.5}
              className="text-[#a3a9b8]"
              aria-hidden="true"
            />
            <span>Prompt log</span>
          </button>
        </div>
      </div>
    </header>
  )
}
