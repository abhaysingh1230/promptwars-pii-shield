import { BookOpen, Lock, ShieldCheck, WifiOff } from 'lucide-react'

interface HeaderProps {
  onOpenPromptLog: () => void
  onDeviceAiStatus: 'available' | 'unavailable'
}

export function Header({ onOpenPromptLog, onDeviceAiStatus }: HeaderProps) {
  return (
    <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur supports-[backdrop-filter]:bg-slate-950/75">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 ring-1 ring-cyan-400/40">
            <ShieldCheck className="h-6 w-6 text-cyan-300" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl">
                PII Shield
              </h1>
              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-xs font-medium text-cyan-300">
                Client-Side Only
              </span>
            </div>
            <p className="text-xs text-slate-400 sm:text-sm">
              Zero-server browser sanitization for logs, resumes, support tickets &amp; CSVs
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300"
            title="All detection, Luhn validation, and redaction run 100% locally in your browser."
          >
            <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
            <span>0 Outbound Requests</span>
          </div>

          <div
            className="hidden items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 md:inline-flex"
            title={
              onDeviceAiStatus === 'available'
                ? 'Chrome Built-in Gemini Nano detected on-device'
                : 'Local deterministic privacy engine active'
            }
          >
            <Lock className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
            <span>
              {onDeviceAiStatus === 'available'
                ? 'Gemini Nano (On-Device)'
                : 'In-Browser Engine'}
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenPromptLog}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-cyan-500/50 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <BookOpen className="h-3.5 w-3.5 text-cyan-300" aria-hidden="true" />
            <span>Prompt Log &amp; Security</span>
          </button>
        </div>
      </div>
    </header>
  )
}
