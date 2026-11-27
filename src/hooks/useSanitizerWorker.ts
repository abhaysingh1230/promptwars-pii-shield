import { useEffect, useMemo, useRef, useState } from 'react'
import { sanitizeCsvDocument } from '../engine/csv'
import { sanitizeText } from '../engine/detector'
import type {
  CustomRule,
  FullMaskStyle,
  PiiCategory,
  RedactionMode,
  SanitizeResult,
} from '../engine/types'
import type {
  SanitizeWorkerRequest,
  SanitizeWorkerResponse,
} from '../workers/sanitizer.worker'

const WORKER_THRESHOLD_CHARS = 25_000
const WORKER_TIMEOUT_MS = 800

interface UseSanitizerWorkerParams {
  rawInput: string
  inputFormat: 'txt' | 'csv'
  mode: RedactionMode
  fullMaskStyle: FullMaskStyle
  enabledCategories: Record<PiiCategory, boolean>
  customRules: CustomRule[]
}

/**
 * Runs sanitization synchronously for small inputs and offloads large or custom-RE2 payloads
 * to a dedicated Web Worker with an 800 ms watchdog timeout.
 */
export function useSanitizerWorker({
  rawInput,
  inputFormat,
  mode,
  fullMaskStyle,
  enabledCategories,
  customRules,
}: UseSanitizerWorkerParams) {
  const [workerResult, setWorkerResult] = useState<SanitizeResult | null>(null)
  const [isWorkerProcessing, setIsWorkerProcessing] = useState(false)
  const [customRuleWarning, setCustomRuleWarning] = useState<string | null>(
    null
  )

  const workerRef = useRef<Worker | null>(null)
  const workerReqIdRef = useRef(0)

  const hasEnabledCustomRules = customRules.some((r) => r.enabled)
  const useBackgroundWorker =
    typeof Worker !== 'undefined' &&
    (rawInput.length >= WORKER_THRESHOLD_CHARS ||
      (hasEnabledCustomRules && rawInput.length > 0))

  const syncResult = useMemo(() => {
    if (useBackgroundWorker) return null
    const options = {
      mode,
      enabledCategories,
      fullMaskStyle,
      isCsv: inputFormat === 'csv',
      customRules,
    }
    return inputFormat === 'csv'
      ? sanitizeCsvDocument(rawInput, options)
      : sanitizeText(rawInput, options)
  }, [
    useBackgroundWorker,
    rawInput,
    inputFormat,
    mode,
    enabledCategories,
    fullMaskStyle,
    customRules,
  ])

  useEffect(() => {
    if (!useBackgroundWorker) return

    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL('../workers/sanitizer.worker.ts', import.meta.url),
        { type: 'module' }
      )
    }

    const requestId = ++workerReqIdRef.current
    const worker = workerRef.current
    let settled = false

    const timeoutId = window.setTimeout(() => {
      if (settled) return
      settled = true
      worker.terminate()
      workerRef.current = null
      setIsWorkerProcessing(false)
      setCustomRuleWarning(
        'Custom regex scan exceeded 800 ms and was terminated safely to keep the page responsive.'
      )
    }, WORKER_TIMEOUT_MS)

    const handleMessage = (event: MessageEvent<SanitizeWorkerResponse>) => {
      if (event.data.requestId === workerReqIdRef.current && !settled) {
        settled = true
        window.clearTimeout(timeoutId)
        setCustomRuleWarning(null)
        setIsWorkerProcessing(false)
        setWorkerResult(event.data.result)
      }
    }

    worker.addEventListener('message', handleMessage)

    const payload: SanitizeWorkerRequest = {
      requestId,
      text: rawInput,
      options: {
        mode,
        enabledCategories,
        fullMaskStyle,
        isCsv: inputFormat === 'csv',
        customRules,
      },
    }
    queueMicrotask(() => {
      if (!settled) setIsWorkerProcessing(true)
    })
    worker.postMessage(payload)

    return () => {
      settled = true
      window.clearTimeout(timeoutId)
      worker.removeEventListener('message', handleMessage)
    }
  }, [
    useBackgroundWorker,
    rawInput,
    inputFormat,
    mode,
    enabledCategories,
    fullMaskStyle,
    customRules,
  ])

  useEffect(() => {
    return () => {
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [])

  const result = useMemo(() => {
    if (syncResult) return syncResult
    if (workerResult) return workerResult
    return sanitizeText('', {
      mode,
      enabledCategories,
      fullMaskStyle,
      isCsv: inputFormat === 'csv',
      customRules,
    })
  }, [
    syncResult,
    workerResult,
    mode,
    enabledCategories,
    fullMaskStyle,
    inputFormat,
    customRules,
  ])

  return {
    result,
    isProcessing: isWorkerProcessing && useBackgroundWorker,
    customRuleWarning,
    clearWarning: () => setCustomRuleWarning(null),
  }
}
