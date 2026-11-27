/**
 * Client-side runtime resource audit using the browser Performance Resource Timing API.
 * Reports only what this browser tab can observe; does not infer guarantees from source code alone.
 */

export interface NetworkAuditSnapshot {
  performanceSupported: boolean
  currentOrigin: string
  observedOrigins: string[]
  externalCalls: number
  sameOriginAssetCalls: number
  verifiedZeroExternalTraffic: boolean
  auditNote: string
}

export function inspectClientNetworkEgress(): NetworkAuditSnapshot {
  const currentOrigin =
    typeof window !== 'undefined' ? window.location.origin : ''

  if (
    typeof performance === 'undefined' ||
    typeof performance.getEntriesByType !== 'function'
  ) {
    return {
      performanceSupported: false,
      currentOrigin,
      observedOrigins: [],
      externalCalls: 0,
      sameOriginAssetCalls: 0,
      verifiedZeroExternalTraffic: false,
      auditNote:
        'Performance Resource Timing API unavailable in this environment; verify traffic directly in DevTools Network.',
    }
  }

  const entries = performance.getEntriesByType('resource') as Array<{
    name?: string
    initiatorType?: string
  }>

  const originSet = new Set<string>()
  let externalCalls = 0
  let sameOriginAssetCalls = 0

  for (const entry of entries) {
    const urlStr = entry.name ?? ''
    if (!urlStr || urlStr.startsWith('blob:') || urlStr.startsWith('data:')) {
      continue
    }

    try {
      const parsed = new URL(urlStr, currentOrigin || 'http://localhost')
      originSet.add(parsed.origin)
      const isSameOrigin = Boolean(currentOrigin && parsed.origin === currentOrigin)

      if (isSameOrigin) {
        sameOriginAssetCalls += 1
      } else {
        externalCalls += 1
      }
    } catch {
      // Ignore malformed internal browser entries
    }
  }

  const observedOrigins = Array.from(originSet)
  const hasObservedEntries = entries.length > 0 || sameOriginAssetCalls > 0

  return {
    performanceSupported: true,
    currentOrigin,
    observedOrigins,
    externalCalls,
    sameOriginAssetCalls,
    verifiedZeroExternalTraffic: hasObservedEntries && externalCalls === 0,
    auditNote:
      externalCalls > 0
        ? `Observed ${externalCalls} cross-origin resource entry(ies) via Performance Resource Timing.`
        : hasObservedEntries
          ? `Observed ${sameOriginAssetCalls} same-origin resource(s) and 0 third-party resource entries in this tab.`
          : 'No resource timing entries recorded yet in this environment; inspect browser DevTools Network to confirm.',
  }
}
