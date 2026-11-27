import { useEffect, useRef, type KeyboardEvent, type RefObject } from 'react'
import { Shield, X } from 'lucide-react'

export type InfoModalTab = 'security' | 'prompts'

interface PromptLogModalProps {
  open: boolean
  activeTab: InfoModalTab
  onTabChange: (tab: InfoModalTab) => void
  onClose: () => void
  returnFocusRef: RefObject<HTMLButtonElement | null>
}

const PROMPT_LOG_STEPS = [
  {
    phase: '1. Threat model and zero-server boundary',
    prompt:
      'Design a browser-only PII sanitization workstation that executes locally without transmitting raw payloads to any external server, supporting pasted text and .txt/.csv files.',
    outcome:
      'Pure TypeScript deterministic pipeline (src/engine/) with Web Worker execution (src/workers/), strict CSP (connect-src none), and zero external font or API requests.',
  },
  {
    phase: '2. Multi-entity detection and standards validation',
    prompt:
      'Detect Emails, Indian/international phones via locally bundled libphonenumber metadata, IPv4/RFC-4291 IPv6, uppercase/mixed-case Indian PAN, Aadhaar, and Luhn-validated Credit Cards.',
    outcome:
      'Implemented Luhn mod-10 diagnostics, Verhoeff status distinction, bundled libphonenumber-js/max phone validation, full/compressed/loopback/IPv4-mapped IPv6 validation, and RE2 linear-time custom rules.',
  },
  {
    phase: '3. Three redaction modes and CSV hardening',
    prompt:
      'Support Full mask, Partial mask, and Pseudonymization across plain text and CSV tables while detecting malformed CSV quotes and escaping formula-leading cells.',
    outcome:
      'Built parseCsvStrict() for explicit quote errors, escapeCsvFormula() for leading whitespace/control-char + formula triggers, and PseudonymRegistry shared across multiline CSV cells.',
  },
  {
    phase: '4. Accessibility, strong vault, and verification',
    prompt:
      'Complete full WCAG keyboard navigation, modal focus trapping with focus return, 600k PBKDF2 AES-GCM vault protection, and live deployment verification.',
    outcome:
      'Verified keyboard tablist navigation, modal focus trap, live regions, Vercel CSP headers, zero third-party network calls, and adversarial unit/UI test suite.',
  },
] as const

export function PromptLogModal({
  open,
  activeTab,
  onTabChange,
  onClose,
  returnFocusRef,
}: PromptLogModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const secTabRef = useRef<HTMLButtonElement>(null)
  const promptTabRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    closeBtnRef.current?.focus()

    function handleKeyDown(e: globalThis.KeyboardEvent) {
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

  function handleTabKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      const next: InfoModalTab = activeTab === 'security' ? 'prompts' : 'security'
      onTabChange(next)
      if (next === 'security') secTabRef.current?.focus()
      else promptTabRef.current?.focus()
    }
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="info-modal-title"
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
                id="info-modal-title"
                className="text-sm font-medium text-[#eef0f5]"
              >
                Security, detection limits, and prompt log
              </h2>
              <p className="text-xs text-[#8b93a7]">
                SECURITY.md · PROMPT_LOG.md · Press Esc to close
              </p>
            </div>
          </div>

          <button
            ref={closeBtnRef}
            type="button"
            onClick={handleClose}
            aria-label="Close security and prompt log dialog"
            className="rounded-lg border border-[#eef0f5]/[0.1] bg-[#161b26] p-1.5 text-[#a3a9b8] hover:text-[#eef0f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee]"
          >
            <X size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>

        <div
          role="tablist"
          aria-label="Documentation sections"
          className="mt-4 inline-flex rounded-lg border border-[#eef0f5]/[0.08] bg-[#090b10] p-0.5"
        >
          <button
            ref={secTabRef}
            id="modal-tab-security"
            type="button"
            role="tab"
            aria-selected={activeTab === 'security'}
            aria-controls="modal-panel-security"
            tabIndex={activeTab === 'security' ? 0 : -1}
            onClick={() => onTabChange('security')}
            onKeyDown={handleTabKeyDown}
            className={`transition-ui rounded-md px-3 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee] ${
              activeTab === 'security'
                ? 'surface-active bg-[#161b26] text-[#eef0f5]'
                : 'text-[#a3a9b8] hover:text-[#eef0f5]'
            }`}
          >
            Security &amp; limitations
          </button>
          <button
            ref={promptTabRef}
            id="modal-tab-prompts"
            type="button"
            role="tab"
            aria-selected={activeTab === 'prompts'}
            aria-controls="modal-panel-prompts"
            tabIndex={activeTab === 'prompts' ? 0 : -1}
            onClick={() => onTabChange('prompts')}
            onKeyDown={handleTabKeyDown}
            className={`transition-ui rounded-md px-3 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee] ${
              activeTab === 'prompts'
                ? 'surface-active bg-[#161b26] text-[#eef0f5]'
                : 'text-[#a3a9b8] hover:text-[#eef0f5]'
            }`}
          >
            Prompt log
          </button>
        </div>

        {activeTab === 'security' ? (
          <div
            id="modal-panel-security"
            role="tabpanel"
            aria-labelledby="modal-tab-security"
            className="mt-4 space-y-3 text-xs text-[#a3a9b8]"
          >
            <div className="rounded-lg border border-[#eef0f5]/[0.08] bg-[#090b10] p-3">
              <h3 className="font-medium text-[#eef0f5]">
                Privacy behavior and CSP
              </h3>
              <p className="mt-1">
                All text scanning, CSV parsing, checksum checks, and downloads run
                locally in browser memory. Static bundle assets load from this
                origin only; no third-party fonts, analytics, or remote APIs are
                called at runtime (`connect-src &apos;none&apos;`).
              </p>
            </div>

            <div className="rounded-lg border border-[#eef0f5]/[0.08] bg-[#090b10] p-3">
              <h3 className="font-medium text-[#eef0f5]">
                Supported formats and validation types
              </h3>
              <ul className="mt-1.5 list-disc space-y-1 pl-4">
                <li>
                  <span className="text-[#eef0f5]">Credit cards (13–19 digits):</span>{' '}
                  Checksum-validated with Luhn mod-10 to avoid redacting random
                  order IDs.
                </li>
                <li>
                  <span className="text-[#eef0f5]">Indian Aadhaar (12 digits):</span>{' '}
                  Detected by UID format and explicitly tagged as either{' '}
                  <span className="font-mono text-[#eef0f5]">
                    Verhoeff checksum verified
                  </span>{' '}
                  or{' '}
                  <span className="font-mono text-[#eef0f5]">
                    Format-matched · checksum unverified
                  </span>
                  .
                </li>
                <li>
                  <span className="text-[#eef0f5]">Phone numbers:</span>{' '}
                  Validated locally against bundled{' '}
                  <span className="font-mono text-[#eef0f5]">
                    libphonenumber-js/max
                  </span>{' '}
                  numbering plans (Indian mobile/STD and international E.164 with
                  extensions).
                </li>
                <li>
                  <span className="text-[#eef0f5]">IPv4 &amp; IPv6:</span> Strict
                  0–255 IPv4 octets and RFC 4291/5952 IPv6 (full, compressed,
                  loopback <span className="font-mono">::1</span>, and
                  IPv4-mapped). The unspecified address{' '}
                  <span className="font-mono">::</span> is excluded.
                </li>
                <li>
                  <span className="text-[#eef0f5]">Custom rules &amp; CSV:</span>{' '}
                  Custom patterns compile with Google&apos;s linear-time RE2
                  engine (<span className="font-mono">re2js</span>). Malformed CSV
                  quotes raise explicit errors and formula-leading cells are
                  escaped with <span className="font-mono">&apos;</span> on
                  export.
                </li>
              </ul>
            </div>

            <div className="rounded-lg border border-[#eef0f5]/[0.08] bg-[#090b10] p-3">
              <h3 className="font-medium text-[#eef0f5]">Known limitations</h3>
              <ul className="mt-1.5 list-disc space-y-1 pl-4">
                <li>
                  Unstructured PII such as free-form person names, street
                  addresses, or custom prose secrets is not detected automatically
                  unless matched by a custom RE2 rule.
                </li>
                <li>
                  Unprefixed 10-digit Indian numbers are limited to mobile
                  prefixes (6–9) to avoid matching arbitrary numeric IDs; STD
                  landlines require a leading <span className="font-mono">0</span>{' '}
                  or <span className="font-mono">+91</span>.
                </li>
                <li>
                  No pattern detector guarantees 100% recall on arbitrary inputs;
                  always review the sanitized diff before sharing sensitive data.
                </li>
              </ul>
            </div>
          </div>
        ) : (
          <div
            id="modal-panel-prompts"
            role="tabpanel"
            aria-labelledby="modal-tab-prompts"
            className="mt-4 space-y-3"
          >
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
        )}
      </div>
    </div>
  )
}
