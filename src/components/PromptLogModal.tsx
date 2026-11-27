import { X, ShieldCheck } from 'lucide-react'

interface PromptLogModalProps {
  open: boolean
  onClose: () => void
}

const PROMPT_LOG_STEPS = [
  {
    phase: '1. Threat Model & Zero-Server Constraint',
    prompt:
      'Design a 100% client-side PII sanitization engine that executes purely in the browser without external API transmission, supporting text paste and .txt/.csv uploads.',
    outcome:
      'Pure TypeScript deterministic pipeline (src/engine/) with zero fetch/XHR calls during sanitization and pure React JSX diff rendering (no dangerouslySetInnerHTML).',
  },
  {
    phase: '2. Multi-Entity Detection & Luhn Validation',
    prompt:
      'Detect Emails, Phones, IPv4/IPv6, Indian PAN, Aadhaar, and Credit Cards with strict Luhn mod-10 validation and overlap resolution so non-Luhn 16-digit IDs are never misclassified.',
    outcome:
      'Implemented Luhn + Verhoeff + IPv4/IPv6 validators, boundary-safe Aadhaar matchers, priority-ordered overlap resolution, and explicit Luhn-rejected telemetry.',
  },
  {
    phase: '3. Three Redaction Modes & CSV Consistency',
    prompt:
      'Support Full Mask ([REDACTED]), Partial Mask (XXXX-XXXX-1234), and Consistent Pseudonymization (EMAIL_01 / CARD_01) across plain text and multi-row CSV files.',
    outcome:
      'Built PseudonymRegistry with canonical normalization (case-insensitive emails, +91 phone normalization) shared across RFC-4180 CSV cells.',
  },
  {
    phase: '4. Auditability, Testing & Cloud Run Packaging',
    prompt:
      'Add side-by-side diff highlighting, 1-click sample datasets, downloadable output, Vitest suite, WCAG accessibility, and Google Cloud Run / Firebase hosting configs.',
    outcome:
      'Shipped accessible React UI, Vitest unit/UI tests, optional on-device Chrome Gemini Nano advisory, and Nginx Dockerfile on port 8080 for Cloud Run.',
  },
  {
    phase: '5. Enterprise Privacy Gateway Upgrades',
    prompt:
      'Add PCI-DSS / India DPDP risk scoring, interactive CSV table diff, click-to-inspect Luhn math proofs, custom secret rules, and AES-GCM-256 local pseudonym restoration.',
    outcome:
      'Implemented compliance.ts, cryptoVault.ts (Web Crypto PBKDF2 + AES-GCM), CSV table diff view, and round-trip re-hydration workbench.',
  },
] as const

export function PromptLogModal({ open, onClose }: PromptLogModalProps) {
  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="prompt-log-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
    >
      <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5 text-cyan-400" aria-hidden="true" />
            <div>
              <h2 id="prompt-log-title" className="text-base font-bold text-white">
                Prompt Engineering Log &amp; Security Architecture
              </h2>
              <p className="text-xs text-slate-400">
                Full log also documented in PROMPT_LOG.md in the repository root
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close prompt log dialog"
            className="rounded-lg border border-slate-700 p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {PROMPT_LOG_STEPS.map((step) => (
            <div
              key={step.phase}
              className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5"
            >
              <h3 className="text-xs font-semibold text-cyan-300">{step.phase}</h3>
              <p className="mt-1 text-xs text-slate-300">
                <span className="font-semibold text-slate-200">Prompt: </span>
                {step.prompt}
              </p>
              <p className="mt-1.5 text-xs text-emerald-300/90">
                <span className="font-semibold text-emerald-300">Outcome: </span>
                {step.outcome}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
