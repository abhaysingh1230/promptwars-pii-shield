import { type RefObject } from 'react'
import { BookOpen, Moon, Shield, ShieldCheck, Sun } from 'lucide-react'
import type { RedactionMode } from '../engine/types'

interface HeaderProps {
  onOpenPromptLog: (initialTab: 'security' | 'prompts') => void
  promptLogTriggerRef: RefObject<HTMLButtonElement | null>
  securityModalTriggerRef: RefObject<HTMLButtonElement | null>
  onDeviceAiStatus: 'available' | 'unavailable'
  totalEntities: number
  mode: RedactionMode
  processingMs: number
  theme: 'dark' | 'light'
  onThemeChange: (theme: 'dark' | 'light') => void
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
  theme,
  onThemeChange,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--bg-header)] backdrop-blur-sm">
      <div className="mx-auto flex min-h-16 max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="surface-active flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border-accent)] bg-gradient-to-b from-[var(--bg-active)] to-[var(--bg-panel)]">
            <Shield
              size={18}
              strokeWidth={1.6}
              className="text-[var(--text-accent)]"
              aria-hidden="true"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-lg font-medium leading-none text-[var(--text-primary)]">
                PII Shield
              </h1>
              <span className="hidden rounded-md border border-[var(--border-accent)]/40 bg-[var(--bg-active)] px-1.5 py-0.5 font-mono text-[11px] font-medium text-[var(--text-accent)] sm:inline">
                v2.6
              </span>
            </div>
            <p className="mt-1 hidden text-xs text-[var(--text-muted)] sm:block">
              Private in-browser sanitizer for logs, tickets, resumes &amp; CSVs
            </p>
          </div>
        </div>

        {/* Live Instrument Readout + Theme Switch + Documentation Triggers */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <div
            aria-label="Live workstation status"
            className="hidden items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-recessed)] px-3 py-1.5 font-mono text-xs tabular-nums text-[var(--text-secondary)] lg:inline-flex"
            title="Text and file processing executes locally in browser memory."
          >
            <span
              className="h-1.5 w-1.5 rounded-full bg-[var(--text-safe)]"
              aria-hidden="true"
            />
            <span className="text-[var(--text-primary)]">
              Processed in this browser
            </span>
            <span className="text-[var(--text-muted)]/60">|</span>
            <span>{totalEntities} detected</span>
            <span className="text-[var(--text-muted)]/60">|</span>
            <span className="text-[var(--text-accent)]">{MODE_LABELS[mode]}</span>
            <span className="hidden text-[var(--text-muted)]/60 xl:inline">|</span>
            <span className="hidden text-[var(--text-muted)] xl:inline">
              {processingMs} ms
            </span>
            {onDeviceAiStatus === 'available' && (
              <>
                <span className="hidden text-[var(--text-muted)]/60 xl:inline">|</span>
                <span className="hidden text-[var(--text-muted)] xl:inline">
                  Gemini Nano
                </span>
              </>
            )}
          </div>

          <div
            role="group"
            aria-label="Theme selection"
            className="instrument-recessed inline-flex h-9 items-center rounded-lg border border-[var(--border-subtle)] p-0.5"
          >
            <button
              type="button"
              aria-pressed={theme === 'dark'}
              onClick={() => onThemeChange('dark')}
              className={`transition-ui inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-solid)] ${
                theme === 'dark'
                  ? 'surface-active bg-[var(--bg-active)] text-[var(--text-primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Moon size={14} strokeWidth={1.5} aria-hidden="true" />
              <span>Dark</span>
            </button>
            <button
              type="button"
              aria-pressed={theme === 'light'}
              onClick={() => onThemeChange('light')}
              className={`transition-ui inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-solid)] ${
                theme === 'light'
                  ? 'surface-active bg-[var(--bg-active)] text-[var(--text-primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Sun size={14} strokeWidth={1.5} aria-hidden="true" />
              <span>Light</span>
            </button>
          </div>

          <button
            ref={securityModalTriggerRef}
            type="button"
            onClick={() => onOpenPromptLog('security')}
            className="transition-ui inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-panel)] px-3 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--border-accent)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-solid)]"
          >
            <ShieldCheck
              size={16}
              strokeWidth={1.5}
              className="text-[var(--text-muted)]"
              aria-hidden="true"
            />
            <span>Security &amp; limits</span>
          </button>

          <button
            ref={promptLogTriggerRef}
            type="button"
            onClick={() => onOpenPromptLog('prompts')}
            className="transition-ui inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-panel)] px-3 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--border-accent)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-solid)]"
          >
            <BookOpen
              size={16}
              strokeWidth={1.5}
              className="text-[var(--text-muted)]"
              aria-hidden="true"
            />
            <span>Prompt log</span>
          </button>
        </div>
      </div>
    </header>
  )
}
