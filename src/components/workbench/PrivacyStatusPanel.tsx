import { Activity, RefreshCw, ShieldCheck } from 'lucide-react'
import type { NetworkAuditSnapshot } from '../../engine/networkAudit'

interface PrivacyStatusPanelProps {
  networkAudit: NetworkAuditSnapshot
  onRecheck: () => void
}

/**
 * Separates client-only user text processing from browser-observable page resource requests
 * via the Performance Resource Timing API.
 */
export function PrivacyStatusPanel({
  networkAudit,
  onRecheck,
}: PrivacyStatusPanelProps) {
  return (
    <div
      id="panel-privacy"
      role="tabpanel"
      aria-labelledby="tab-privacy"
      className="grid gap-4 lg:grid-cols-12"
    >
      <div className="space-y-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-recessed)] p-3.5 text-xs lg:col-span-6">
        <div className="flex items-center gap-2 font-display font-medium text-[var(--text-primary)]">
          <ShieldCheck
            size={16}
            strokeWidth={1.5}
            className="text-[var(--text-safe)]"
            aria-hidden="true"
          />
          <span>What is processed locally (no user text is transmitted)</span>
        </div>
        <ul className="list-disc space-y-1.5 pl-4 text-[var(--text-secondary)]">
          <li>
            <span className="text-[var(--text-primary)]">
              No user text is transmitted:
            </span>{' '}
            Detection, Luhn/Verhoeff checksums, bundled{' '}
            <span className="font-mono">libphonenumber-js/max</span>, and RE2 Web
            Worker matching run in local browser memory with zero remote API
            calls.
          </li>
          <li>
            <span className="text-[var(--text-primary)]">
              Page asset requests vs. user data:
            </span>{' '}
            Loading the page initially requests same-origin app files (HTML, JS,
            CSS, local Space Grotesk fonts); subsequent sanitization sends no
            payloads over the network.
          </li>
          <li>
            <span className="text-[var(--text-primary)]">
              CSV, Vault &amp; Receipts:
            </span>{' '}
            Strict CSV parsing, formula escaping, PBKDF2 + AES-GCM vault export,
            and metadata-only Privacy Receipts stay client-side.
          </li>
          <li>
            <span className="text-[var(--text-primary)]">Storage behavior:</span>{' '}
            Raw text and PII are never written to cookies, IndexedDB, or{' '}
            <span className="font-mono">localStorage</span> (only UI theme
            preference <span className="font-mono">pii-shield-theme</span> is
            saved).
          </li>
        </ul>
      </div>

      <div className="space-y-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-recessed)] p-3.5 text-xs lg:col-span-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-display font-medium text-[var(--text-primary)]">
            <Activity
              size={16}
              strokeWidth={1.5}
              className="text-[var(--text-accent)]"
              aria-hidden="true"
            />
            <span>Browser-observable page resource check</span>
          </div>
          <button
            type="button"
            onClick={onRecheck}
            className="transition-ui inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--border-strong)] bg-[var(--bg-panel)] px-2.5 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--border-accent)]"
          >
            <RefreshCw size={13} strokeWidth={1.5} aria-hidden="true" />
            <span>Re-check</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 font-mono tabular-nums">
          <div className="rounded border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-2.5">
            <div className="text-[11px] text-[var(--text-muted)]">
              Same-origin page assets
            </div>
            <div className="mt-0.5 text-base font-medium text-[var(--text-primary)]">
              {networkAudit.sameOriginAssetCalls}
            </div>
          </div>
          <div className="rounded border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-2.5">
            <div className="text-[11px] text-[var(--text-muted)]">
              Cross-origin entries observed
            </div>
            <div
              className={`mt-0.5 text-base font-medium ${
                networkAudit.externalCalls === 0
                  ? 'text-[var(--text-safe)]'
                  : 'text-[var(--text-danger)]'
              }`}
            >
              {networkAudit.externalCalls}
            </div>
          </div>
        </div>

        <p className="text-[var(--text-secondary)]">{networkAudit.auditNote}</p>

        {networkAudit.observedOrigins.length > 0 && (
          <p className="font-mono text-[11px] text-[var(--text-muted)]">
            Observed origin(s): {networkAudit.observedOrigins.join(', ')}
          </p>
        )}

        <p className="border-t border-[var(--border-subtle)] pt-2 text-[11px] text-[var(--text-muted)]">
          What this can verify: only requests visible to this tab&apos;s{' '}
          <span className="font-mono">
            performance.getEntriesByType(&apos;resource&apos;)
          </span>{' '}
          API. It distinguishes page asset loading from user data; verify all
          live requests independently in DevTools → Network.
        </p>
      </div>
    </div>
  )
}
