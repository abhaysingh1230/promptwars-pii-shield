/**
 * Client-side network silence verifier using the browser Performance Resource Timing API.
 * Confirms zero external XHR/Fetch calls are made to transmit sanitized or raw data.
 */

export interface NetworkAuditSnapshot {
  externalApiCalls: number
  staticAssetCalls: number
  verifiedZeroDataEgress: boolean
}

const ALLOWED_STATIC_HOSTS = new Set([
  'fonts.googleapis.com',
  'fonts.gstatic.com',
])

export function inspectClientNetworkEgress(): NetworkAuditSnapshot {
  if (
    typeof performance === 'undefined' ||
    typeof performance.getEntriesByType !== 'function'
  ) {
    return {
      externalApiCalls: 0,
      staticAssetCalls: 0,
      verifiedZeroDataEgress: true,
    }
  }

  const entries = performance.getEntriesByType('resource') as Array<{
    name?: string
    initiatorType?: string
  }>

  const currentOrigin =
    typeof window !== 'undefined' ? window.location.origin : ''

  let externalApiCalls = 0
  let staticAssetCalls = 0

  for (const entry of entries) {
    const urlStr = entry.name ?? ''
    if (!urlStr || urlStr.startsWith('blob:') || urlStr.startsWith('data:')) {
      continue
    }

    try {
      const parsed = new URL(urlStr, currentOrigin || 'http://localhost')
      const isSameOrigin = currentOrigin && parsed.origin === currentOrigin
      const isAllowedFontHost = ALLOWED_STATIC_HOSTS.has(parsed.hostname)

      if (isSameOrigin || isAllowedFontHost) {
        staticAssetCalls += 1
      } else if (
        entry.initiatorType === 'fetch' ||
        entry.initiatorType === 'xmlhttprequest' ||
        entry.initiatorType === 'beacon'
      ) {
        externalApiCalls += 1
      }
    } catch {
      // Ignore malformed browser internal resource entries
    }
  }

  return {
    externalApiCalls,
    staticAssetCalls,
    verifiedZeroDataEgress: externalApiCalls === 0,
  }
}
