import { BookOpen, Cpu, ShieldCheck, WifiOff } from 'lucide-react'

interface HeaderProps {
  onOpenPromptLog: () => void
  onDeviceAiStatus: 'available' | 'unavailable'
}

export function Header({ onOpenPromptLog, onDeviceAiStatus }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400/20 via-sky-500/15 to-emerald-500/20 ring-1 ring-cyan-400/40 shadow-lg shadow-cyan-500/10">
            <ShieldCheck className="h-5 w-5 text-cyan-300" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-white sm:text-lg">
                PII Shield
              </h1>
              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] font-medium text-cyan-300">
                Client-Side Only
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Browser privacy airlock for logs, support tickets, resumes &amp; CSVs
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-300"
            title="All detection, Luhn validation, and redaction run 100% locally in your browser."
          >
            <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
            <span>0 Outbound Requests</span>
          </div>

          <div
            className="hidden items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/90 px-2.5 py-1.5 text-xs font-medium text-slate-300 md:inline-flex"
            title={
              onDeviceAiStatus === 'available'
                ? 'Chrome Built-in Gemini Nano detected on-device'
                : 'Local deterministic privacy engine active'
            }
          >
            <Cpu className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
            <span>
              {onDeviceAiStatus === 'available'
                ? 'Gemini Nano (On-Device)'
                : 'Local Engine + Web Crypto'}
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenPromptLog}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/90 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-cyan-400/60 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <BookOpen className="h-3.5 w-3.5 text-cyan-300" aria-hidden="true" />
            <span>Prompt Log &amp; Security</span>
          </button>
        </div>
      </div>
    </header>
  )
}
