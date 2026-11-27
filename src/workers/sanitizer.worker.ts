import { sanitizeCsvDocument } from '../engine/csv'
import { sanitizeText } from '../engine/detector'
import type { SanitizeOptions, SanitizeResult } from '../engine/types'

export interface SanitizeWorkerRequest {
  requestId: number
  text: string
  options: SanitizeOptions
}

export interface SanitizeWorkerResponse {
  requestId: number
  result: SanitizeResult
}

/**
 * Dedicated Web Worker for non-blocking sanitization of large logs and CSV files.
 */
self.onmessage = (event: MessageEvent<SanitizeWorkerRequest>) => {
  const { requestId, text, options } = event.data
  const result = options.isCsv
    ? sanitizeCsvDocument(text, options)
    : sanitizeText(text, options)

  const response: SanitizeWorkerResponse = { requestId, result }
  self.postMessage(response)
}
