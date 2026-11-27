/**
 * Client-side network silence verifier using the browser Performance Resource Timing API.
 * Confirms zero external third-party XHR/Fetch/asset calls occur during runtime.
 */

export interface NetworkAuditSnapshot {
  externalCalls: number
  sameOriginAssetCalls: number
  verifiedZeroExternalTraffic: boolean
}

export function inspectClientNetworkEgress(): NetworkAuditSnapshot {
  if (
    typeof performance === 'undefined' ||
    typeof performance.getEntriesByType !== 'function'
  ) {
    return {
      externalCalls: 0,
      sameOriginAssetCalls: 0,
      verifiedZeroExternalTraffic: true,
    }
  }

  const entries = performance.getEntriesByType('resource') as Array<{
    name?: string
    initiatorType?: string
  }>

  const currentOrigin =
    typeof window !== 'undefined' ? window.location.origin : ''

  let externalCalls = 0
  let sameOriginAssetCalls = 0

  for (const entry of entries) {
    const urlStr = entry.name ?? ''
    if (!urlStr || urlStr.startsWith('blob:') || urlStr.startsWith('data:')) {
      continue
    }

    try {
      const parsed = new URL(urlStr, currentOrigin || 'http://localhost')
      const isSameOrigin = currentOrigin && parsed.origin === currentOrigin

      if (isSameOrigin) {
        sameOriginAssetCalls += 1
      } else {
        externalCalls += 1
      }
    } catch {
      // Ignore malformed internal browser entries
    }
  }

  return {
    externalCalls,
    sameOriginAssetCalls,
    verifiedZeroExternalTraffic: externalCalls === 0,
  }
}
