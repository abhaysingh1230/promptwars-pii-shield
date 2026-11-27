import { useEffect, useRef } from 'react'
import { Shield, X } from 'lucide-react'

interface PromptLogModalProps {
  open: boolean
  onClose: () => void
}

const PROMPT_LOG_STEPS = [
  {
    phase: '1. Threat model and zero-server boundary',
    prompt:
      'Design a 100% client-side PII sanitization engine that executes purely in the browser without external API transmission, supporting text paste and .txt/.csv uploads.',
    outcome:
      'Pure TypeScript deterministic pipeline (src/engine/) with Web Worker offloading (src/workers/), zero fetch/XHR calls during sanitization, and pure React JSX diff rendering.',
  },
  {
    phase: '2. Multi-entity detection and Luhn validation',
    prompt:
      'Detect Emails, Phones, IPv4/IPv6, Indian PAN, Aadhaar, and Credit Cards with strict Luhn mod-10 validation and overlap resolution so non-Luhn 16-digit IDs are never misclassified.',
    outcome:
      'Implemented Luhn + Verhoeff + IPv4/IPv6 validators, boundary-safe Aadhaar matchers, priority-ordered overlap resolution, and mathematical Luhn checksum telemetry.',
  },
  {
    phase: '3. Three redaction modes and CSV consistency',
    prompt:
      'Support Full Mask ([REDACTED]), Partial Mask (XXXX-XXXX-1234), and Consistent Pseudonymization (EMAIL_01 / CARD_01) across plain text and multi-row CSV files.',
    outcome:
      'Built PseudonymRegistry with canonical normalization (case-insensitive emails, +91 phone normalization) shared across RFC-4180 CSV cells.',
  },
  {
    phase: '4. Auditability, testing, and Google Cloud Run',
    prompt:
      'Add side-by-side diff highlighting, 1-click sample datasets, downloadable output, Vitest suite, WCAG accessibility, and Google Cloud Run / Firebase hosting configs.',
    outcome:
      'Shipped accessible React UI, Vitest unit/UI tests, optional on-device Chrome Gemini Nano advisory, Cloud Build (cloudbuild.yaml), and Nginx Dockerfile on port 8080.',
  },
  {
    phase: '5. Enterprise gateway and Unslop UI refinement',
    prompt:
      'Apply restrained ink-dark UI craftsmanship following heydamir/unslop guidelines so the entire workflow fits comfortably on standard phones and laptops.',
    outcome:
      'Unified Ink neutral ramp, 4px spacing scale, sentence-case typography, AES-GCM-256 local vault, and compact above-the-fold diff workspace.',
  },
] as const

export function PromptLogModal({ open, onClose }: PromptLogModalProps) {
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    closeBtnRef.current?.focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="prompt-log-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0d14]/80 p-4 backdrop-blur-sm"
    >
      <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-xl border border-[#eef0f5]/[0.1] bg-[#11141c] p-5">
        <div className="flex items-start justify-between gap-4 border-b border-[#eef0f5]/[0.08] pb-4">
          <div className="flex items-center gap-2.5">
            <Shield
              size={16}
              strokeWidth={1.5}
              className="text-[#a3a9b8]"
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
                Full log in PROMPT_LOG.md · Security policy in SECURITY.md (Esc to close)
              </p>
            </div>
          </div>

          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close prompt log dialog"
            className="rounded-lg border border-[#eef0f5]/[0.08] bg-[#1a1e28] p-1.5 text-[#a3a9b8] hover:text-[#eef0f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8]"
          >
            <X size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {PROMPT_LOG_STEPS.map((step) => (
            <div
              key={step.phase}
              className="rounded-lg border border-[#eef0f5]/[0.08] bg-[#0b0d14] p-3"
            >
              <h3 className="text-xs font-medium text-[#38bdf8]">
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
