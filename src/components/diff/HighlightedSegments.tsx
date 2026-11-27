import {
  PII_CATEGORY_META,
  type DiffSegment,
  type PiiEntity,
} from '../../engine/types'

interface HighlightedSegmentsProps {
  segments: DiffSegment[]
  variant: 'original' | 'sanitized'
  selectedId: string | null
  onSelectEntity: (entity: PiiEntity) => void
}

/**
 * Renders interactive highlighted PII tokens alongside plain text spans using pure JSX.
 */
export function HighlightedSegments({
  segments,
  variant,
  selectedId,
  onSelectEntity,
}: HighlightedSegmentsProps) {
  if (segments.length === 0) {
    return null
  }

  return (
    <>
      {segments.map((seg, idx) => {
        if (seg.type === 'text' || !seg.entity) {
          return <span key={idx}>{seg.text}</span>
        }

        const entity = seg.entity
        const meta = PII_CATEGORY_META[entity.category]
        const isSelected = selectedId === entity.id
        const tooltip = [
          meta.label,
          entity.validationNote ? `(${entity.validationNote})` : '',
          variant === 'original' ? `→ ${entity.replacement}` : '← redacted',
        ]
          .filter(Boolean)
          .join(' ')

        return (
          <button
            key={`${entity.id}-${idx}`}
            type="button"
            onClick={() => onSelectEntity(entity)}
            title={tooltip}
            aria-label={tooltip}
            className={`transition-ui inline cursor-pointer rounded px-1 py-0.5 font-mono text-[13px] ${
              variant === 'original' ? meta.highlightClass : meta.redactedClass
            } ${isSelected ? 'pii-selected ring-1 ring-[var(--accent-solid)]' : ''}`}
          >
            {seg.text}
          </button>
        )
      })}
    </>
  )
}
