import { Info } from 'lucide-react'
import { PII_CATEGORY_META, type PiiEntity } from '../../engine/types'
import { isVerifiedEntity } from './entityConfidence'

interface EntityInspectorProps {
  entity: PiiEntity
  onDismiss: () => void
}

/**
 * Displays category, verification confidence, detection rationale, and replacement token
 * for the currently selected PII highlight.
 */
export function EntityInspector({ entity, onDismiss }: EntityInspectorProps) {
  const verified = isVerifiedEntity(entity)

  return (
    <div
      role="status"
      aria-label="Selected entity validation details"
      className="instrument-panel animate-card-reveal flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-accent)] px-4 py-2.5 text-xs"
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <Info
          size={16}
          strokeWidth={1.5}
          className="text-[var(--text-accent)]"
          aria-hidden="true"
        />
        <span
          className={`h-2 w-2 rounded-full ${
            PII_CATEGORY_META[entity.category].dotClass
          }`}
          aria-hidden="true"
        />
        <span className="font-display font-medium text-[var(--text-primary)]">
          {PII_CATEGORY_META[entity.category].label}
        </span>
        <span
          className={`rounded-md border px-2 py-0.5 font-mono text-xs ${
            verified
              ? 'border-[var(--border-safe)] bg-[var(--bg-protected-well)] text-[var(--text-safe)]'
              : 'border-[#f59e0b]/45 bg-[#f59e0b]/10 text-[var(--text-warn)]'
          }`}
        >
          {verified
            ? 'Checksum / plan verified'
            : 'Format-matched · review recommended'}
        </span>
        {entity.validationNote && (
          <span className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-recessed)] px-2 py-0.5 font-mono text-xs text-[var(--text-secondary)]">
            Why: {entity.validationNote}
          </span>
        )}
        <span className="text-[var(--text-muted)]">→ Replacement</span>
        <code className="rounded-md border border-[var(--border-strong)] bg-[var(--bg-recessed)] px-2 py-0.5 font-mono text-xs text-[var(--text-primary)]">
          {entity.replacement}
        </code>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="transition-ui rounded-md border border-transparent px-2 py-1 text-xs text-[var(--text-secondary)] hover:border-[var(--border-subtle)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-solid)]"
      >
        Dismiss
      </button>
    </div>
  )
}
