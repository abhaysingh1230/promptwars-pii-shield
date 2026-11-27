import { useEffect, useRef, type RefObject } from 'react'
import { Shield, X } from 'lucide-react'

interface PromptLogModalProps {
  open: boolean
  onClose: () => void
  returnFocusRef: RefObject<HTMLButtonElement | null>
}

const PROMPT_LOG_STEPS = [
  {
    phase: '1. Threat model and zero-server boundary',
    prompt:
      'Design a browser-only PII sanitization workstation that executes locally without transmitting raw payloads to any external server, supporting pasted text and .txt/.csv files.',
    outcome:
      'Pure TypeScript deterministic pipeline (src/engine/) with Web Worker execution (src/workers/), strict CSP (connect-src none), and zero external font/API requests.',
  },
  {
    phase: '2. Multi-entity detection and Luhn validation',
    prompt:
      'Detect Emails, Indian/international phones, IPv4/IPv6, uppercase and mixed-case Indian PAN, Aadhaar, and Credit Cards with Luhn mod-10 validation and Unicode boundary safety.',
    outcome:
      'Implemented Luhn + Verhoeff + IPv4/IPv6 validators, mixed-case PAN entity-code validation, boundary-safe Aadhaar matchers, and overlap resolution.',
  },
  {
    phase: '3. Three redaction modes and CSV hardening',
    prompt:
      'Support Full mask, Partial mask, and Consistent pseudonymization across plain text and CSV tables with strict malformed-CSV errors and spreadsheet formula escaping.',
    outcome:
      'Built parseCsvStrict() for explicit quote errors, escapeCsvFormula() for safe exports, and PseudonymRegistry shared across multiline CSV cells.',
  },
  {
    phase: '4. Auditability, custom rule isolation, and strong vault',
    prompt:
      'Run user custom regexes inside a terminable Web Worker with ReDoS rejection, harden PBKDF2 to 600,000 iterations, and ship full WCAG keyboard accessibility.',
    outcome:
      'Added 800 ms terminable worker watchdog, 600k PBKDF2 + AES-GCM-256 vault, keyboard tablist navigation, modal focus trap with focus return, and Vercel CSP headers.',
  },
] as const

export function PromptLogModal({
  open,
  onClose,
  returnFocusRef,
}: PromptLogModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    closeBtnRef.current?.focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        returnFocusRef.current?.focus()
        return
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => !el.hasAttribute('disabled'))

        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose, returnFocusRef])

  function handleClose() {
    onClose()
    queueMicrotask(() => {
      returnFocusRef.current?.focus()
    })
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="prompt-log-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#090b10]/85 p-4 backdrop-blur-sm"
    >
      <div
        ref={dialogRef}
        className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-xl border border-[#eef0f5]/[0.12] bg-[#0f131b] p-5"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#eef0f5]/[0.08] pb-4">
          <div className="flex items-center gap-2.5">
            <Shield
              size={16}
              strokeWidth={1.5}
              className="text-[#22d3ee]"
              aria-hidden="true"
            />
            <div>
              <h2
                id="prompt-log-title"
                className="text-sm font-medium text-[#eef0f5]"
              >
                Prompt engineering log and security architecture
              </h2>
              <p className="text-xs text-[#7a8296]">
                PROMPT_LOG.md · SECURITY.md · Press Esc to close
              </p>
            </div>
          </div>

          <button
            ref={closeBtnRef}
            type="button"
            onClick={handleClose}
            aria-label="Close prompt log dialog"
            className="rounded-lg border border-[#eef0f5]/[0.1] bg-[#161b26] p-1.5 text-[#a3a9b8] hover:text-[#eef0f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee]"
          >
            <X size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {PROMPT_LOG_STEPS.map((step) => (
            <div
              key={step.phase}
              className="rounded-lg border border-[#eef0f5]/[0.08] bg-[#090b10] p-3"
            >
              <h3 className="text-xs font-medium text-[#22d3ee]">
                {step.phase}
              </h3>
              <p className="mt-1 text-xs text-[#a3a9b8]">
                <span className="font-medium text-[#eef0f5]">Prompt: </span>
                {step.prompt}
              </p>
              <p className="mt-1.5 text-xs text-[#a3a9b8]">
                <span className="font-medium text-[#4cc38a]">Outcome: </span>
                {step.outcome}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
