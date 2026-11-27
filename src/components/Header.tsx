import { BookOpen, Shield } from 'lucide-react'

interface HeaderProps {
  onOpenPromptLog: () => void
  onDeviceAiStatus: 'available' | 'unavailable'
}

export function Header({ onOpenPromptLog, onDeviceAiStatus }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#eef0f5]/[0.08] bg-[#0b0d14]/95 backdrop-blur-sm">
      <div className="mx-auto flex min-h-14 max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#eef0f5]/[0.1] bg-[#1a1e28]">
            <Shield
              size={16}
              strokeWidth={1.5}
              className="text-[#eef0f5]"
              aria-hidden="true"
            />
          </div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <h1 className="text-base font-semibold leading-none text-[#eef0f5]">
              PII Shield
            </h1>
            <p className="hidden text-xs text-[#7a8296] sm:inline">
              Browser-only sanitization for logs, resumes, tickets, and CSVs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div
            className="hidden items-center gap-2 font-mono text-xs tabular-nums text-[#a3a9b8] sm:inline-flex"
            title="All detection, Luhn checks, and redaction execute locally in browser memory"
          >
            <span
              className="h-1.5 w-1.5 rounded-full bg-[#4cc38a]"
              aria-hidden="true"
            />
            <span>0 outbound requests</span>
            {onDeviceAiStatus === 'available' && (
              <span className="text-[#7a8296]">· Gemini Nano ready</span>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenPromptLog}
            className="transition-unslop inline-flex h-9 items-center gap-2 rounded-lg border border-[#eef0f5]/[0.08] bg-[#1a1e28] px-3 text-xs font-medium text-[#eef0f5] hover:border-[#eef0f5]/20 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8]"
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
