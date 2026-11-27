import { type KeyboardEvent, type RefObject } from 'react'

/**
 * Handles WAI-ARIA roving tabindex keyboard navigation (ArrowLeft, ArrowRight, Home, End)
 * for horizontal tablists.
 */
export function handleRovingTabKeyDown<T extends string>(
  e: KeyboardEvent<HTMLButtonElement>,
  current: T,
  order: readonly T[],
  onSelect: (next: T) => void,
  tabRefs: RefObject<Record<T, HTMLButtonElement | null>>
): void {
  const idx = order.indexOf(current)
  if (idx === -1) return

  let nextIdx = idx
  if (e.key === 'ArrowRight') nextIdx = (idx + 1) % order.length
  else if (e.key === 'ArrowLeft')
    nextIdx = (idx - 1 + order.length) % order.length
  else if (e.key === 'Home') nextIdx = 0
  else if (e.key === 'End') nextIdx = order.length - 1
  else return

  e.preventDefault()
  const nextTab = order[nextIdx]
  onSelect(nextTab)
  tabRefs.current[nextTab]?.focus()
}
