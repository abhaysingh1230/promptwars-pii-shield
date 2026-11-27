import { useEffect, useMemo, useRef, useState } from 'react'
import { ControlsBar } from './components/ControlsBar'
import { DiffViewer } from './components/DiffViewer'
import { Header } from './components/Header'
import {
  PromptLogModal,
  type InfoModalTab,
} from './components/PromptLogModal'
import { SecurityWorkbench } from './components/SecurityWorkbench'
import type { SampleDataset } from './data/samples'
import { runSyntheticBenchmark, type BenchmarkReport } from './engine/benchmark'
import {
  detectOnDeviceAiStatus,
  generateOnDevicePrivacySummary,
  type OnDeviceAdviceResult,
} from './engine/chromeAi'
import { assessPrivacyRisk } from './engine/compliance'
import { sanitizeCsvDocument } from './engine/csv'
import { sanitizeText } from './engine/detector'
import { buildPrivacyReceipt } from './engine/receipt'
import {
  DEFAULT_ENABLED_CATEGORIES,
  type CustomRule,
  type FullMaskStyle,
  type PiiCategory,
  type RedactionMode,
  type SanitizeResult,
} from './engine/types'
import type {
  SanitizeWorkerRequest,
  SanitizeWorkerResponse,
} from './workers/sanitizer.worker'

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
const WORKER_THRESHOLD_CHARS = 25_000
const WORKER_TIMEOUT_MS = 800

function triggerClientDownload(
  content: string,
  filename: string,
  mimeType: string
) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function App() {
  const [rawInput, setRawInput] = useState<string>('')
  const [inputFormat, setInputFormat] = useState<'txt' | 'csv'>('txt')
  const [activeFileName, setActiveFileName] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [mode, setMode] = useState<RedactionMode>('partial')
  const [fullMaskStyle, setFullMaskStyle] = useState<FullMaskStyle>('generic')
  const [enabledCategories, setEnabledCategories] = useState<
    Record<PiiCategory, boolean>
  >({ ...DEFAULT_ENABLED_CATEGORIES })
  const [customRules, setCustomRules] = useState<CustomRule[]>([])
  const [customRuleWarning, setCustomRuleWarning] = useState<string | null>(
    null
  )
  const [promptLogOpen, setPromptLogOpen] = useState(false)
  const [infoModalTab, setInfoModalTab] = useState<InfoModalTab>('security')
  const [onDeviceAiStatus, setOnDeviceAiStatus] = useState<
    'available' | 'unavailable'
  >('unavailable')
  const [privacyAdvice, setPrivacyAdvice] =
    useState<OnDeviceAdviceResult | null>(null)
  const [workerResult, setWorkerResult] = useState<SanitizeResult | null>(null)
  const [isWorkerProcessing, setIsWorkerProcessing] = useState(false)
  const [benchmarkReport, setBenchmarkReport] =
    useState<BenchmarkReport | null>(null)
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('light')
      ? 'light'
      : 'dark'
  )

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('dark', 'light')
    root.classList.add(theme)
    try {
      localStorage.setItem('pii-shield-theme', theme)
    } catch {
      // Ignore storage restrictions
    }
  }, [theme])

  const promptLogTriggerRef = useRef<HTMLButtonElement>(null)
  const securityModalTriggerRef = useRef<HTMLButtonElement>(null)
  const modalOpenerRef = useRef<HTMLButtonElement | null>(null)
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
        new URL('./workers/sanitizer.worker.ts', import.meta.url),
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

  const complianceAssessment = useMemo(() => assessPrivacyRisk(result), [result])

  useEffect(() => {
    let cancelled = false
    const g = globalThis as unknown as {
      LanguageModel?: unknown
      ai?: { languageModel?: unknown }
    }
    if (!g.LanguageModel && !g.ai?.languageModel) {
      return
    }
    detectOnDeviceAiStatus().then((status) => {
      if (!cancelled) setOnDeviceAiStatus(status)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const deterministicAdvice = useMemo<OnDeviceAdviceResult>(() => {
    const highRiskCount =
      result.countsByCategory.credit_card +
      result.countsByCategory.pan +
      result.countsByCategory.aadhaar
    const total = result.totalEntities
    if (total === 0) {
      return {
        source: 'local-engine',
        summary:
          'No built-in PII patterns matched in this payload under active filters.',
      }
    }
    const scopeNote =
      highRiskCount > 0
        ? `Matched ${highRiskCount} financial/government ID pattern(s)`
        : `Matched ${total} contact/network pattern(s)`
    const luhnNote =
      result.luhnRejected.length > 0
        ? ` and excluded ${result.luhnRejected.length} non-Luhn 16-digit candidate(s).`
        : '.'
    return {
      source: 'local-engine',
      summary: `${scopeNote}${luhnNote} Redacted ${total} item(s) locally under "${mode}" mode.`,
    }
  }, [
    result.countsByCategory,
    result.totalEntities,
    result.luhnRejected.length,
    mode,
  ])

  useEffect(() => {
    if (onDeviceAiStatus !== 'available') {
      return
    }
    let cancelled = false
    generateOnDevicePrivacySummary(
      result.countsByCategory,
      result.luhnRejected.length,
      mode
    ).then((advice) => {
      if (!cancelled) setPrivacyAdvice(advice)
    })
    return () => {
      cancelled = true
    }
  }, [onDeviceAiStatus, result.countsByCategory, result.luhnRejected.length, mode])

  const activePrivacyAdvice =
    onDeviceAiStatus === 'available' && privacyAdvice
      ? privacyAdvice
      : deterministicAdvice

  function handleToggleCategory(category: PiiCategory) {
    setEnabledCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }))
  }

  function handleLoadSample(sample: SampleDataset) {
    setUploadError(null)
    setActiveFileName(`${sample.id}.${sample.format}`)
    setInputFormat(sample.format)
    setRawInput(sample.content)
  }

  function handleUploadFile(file: File) {
    setUploadError(null)
    const lower = file.name.toLowerCase()
    const isTxt = lower.endsWith('.txt')
    const isCsv = lower.endsWith('.csv')

    if (!isTxt && !isCsv) {
      setUploadError(
        `Unsupported file "${file.name}". Please upload a .txt or .csv file.`
      )
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError(
        `File exceeds 5 MB client-side limit (${(file.size / 1024 / 1024).toFixed(2)} MB).`
      )
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : ''
      setActiveFileName(file.name)
      setInputFormat(isCsv ? 'csv' : 'txt')
      setRawInput(content)
    }
    reader.onerror = () => {
      setUploadError('Failed to read the selected file locally.')
    }
    reader.readAsText(file)
  }

  function handleRawInputChange(value: string) {
    setUploadError(null)
    setRawInput(value)
  }

  function handleClear() {
    setUploadError(null)
    setCustomRuleWarning(null)
    setActiveFileName(null)
    setInputFormat('txt')
    setRawInput('')
  }

  function handleAddCustomRule(rule: CustomRule) {
    setCustomRules((prev) => [...prev, rule])
  }

  function handleToggleCustomRule(id: string) {
    setCustomRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    )
  }

  function handleDeleteCustomRule(id: string) {
    setCustomRules((prev) => prev.filter((r) => r.id !== id))
  }

  const downloadFileName = activeFileName
    ? activeFileName.replace(/\.(txt|csv)$/i, '.sanitized.$1')
    : inputFormat === 'csv'
      ? 'sanitized-output.csv'
      : 'sanitized-output.txt'

  function handleDownloadSanitized() {
    if (!result.sanitizedText || result.csvParseError) return
    const mime =
      inputFormat === 'csv'
        ? 'text/csv;charset=utf-8'
        : 'text/plain;charset=utf-8'
    triggerClientDownload(result.sanitizedText, downloadFileName, mime)
  }

  function handleRunBenchmark() {
    const report = runSyntheticBenchmark()
    setBenchmarkReport(report)
  }

  function handleDownloadPrivacyReceipt() {
    if (result.csvParseError) return
    const receipt = buildPrivacyReceipt({
      result,
      mode,
      inputFormat,
      benchmarkReport,
    })
    triggerClientDownload(
      JSON.stringify(receipt, null, 2),
      'pii-privacy-receipt.json',
      'application/json;charset=utf-8'
    )
  }

  return (
    <div className="workstation-canvas min-h-screen text-[var(--text-primary)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[var(--cta-solid)] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-[var(--cta-solid-text)]"
      >
        Skip to sanitization workspace
      </a>

      <Header
        onOpenPromptLog={(tab) => {
          modalOpenerRef.current =
            tab === 'security'
              ? securityModalTriggerRef.current
              : promptLogTriggerRef.current
          setInfoModalTab(tab)
          setPromptLogOpen(true)
        }}
        promptLogTriggerRef={promptLogTriggerRef}
        securityModalTriggerRef={securityModalTriggerRef}
        onDeviceAiStatus={onDeviceAiStatus}
        totalEntities={result.totalEntities}
        mode={mode}
        processingMs={result.processingMs}
        theme={theme}
        onThemeChange={setTheme}
      />

      <main
        id="main-content"
        className="mx-auto max-w-[1440px] space-y-4 px-4 py-4 sm:px-6"
      >
        <ControlsBar
          mode={mode}
          onModeChange={setMode}
          fullMaskStyle={fullMaskStyle}
          onFullMaskStyleChange={setFullMaskStyle}
          enabledCategories={enabledCategories}
          onToggleCategory={handleToggleCategory}
          countsByCategory={result.countsByCategory}
          onLoadSample={handleLoadSample}
          onUploadFile={handleUploadFile}
          onClear={handleClear}
          onDownloadSanitized={handleDownloadSanitized}
          canDownload={
            Boolean(result.sanitizedText) && !result.csvParseError
          }
          downloadFileName={downloadFileName}
          activeFileName={activeFileName}
          uploadError={uploadError}
        />

        <DiffViewer
          rawInput={rawInput}
          onRawInputChange={handleRawInputChange}
          result={result}
          mode={mode}
          isProcessing={isWorkerProcessing && useBackgroundWorker}
          downloadFileName={downloadFileName}
          onDownloadSanitized={handleDownloadSanitized}
          onLoadSample={handleLoadSample}
          onRequestUpload={() => {
            const el = document.getElementById(
              'pii-file-upload'
            ) as HTMLInputElement | null
            el?.click()
          }}
        />

        <SecurityWorkbench
          result={result}
          assessment={complianceAssessment}
          mode={mode}
          privacyAdvice={activePrivacyAdvice}
          customRules={customRules}
          customRuleWarning={customRuleWarning}
          benchmarkReport={benchmarkReport}
          onRunBenchmark={handleRunBenchmark}
          onAddCustomRule={handleAddCustomRule}
          onToggleCustomRule={handleToggleCustomRule}
          onDeleteCustomRule={handleDeleteCustomRule}
          onDownloadPrivacyReceipt={handleDownloadPrivacyReceipt}
        />
      </main>

      <PromptLogModal
        open={promptLogOpen}
        activeTab={infoModalTab}
        onTabChange={setInfoModalTab}
        onClose={() => setPromptLogOpen(false)}
        returnFocusRef={modalOpenerRef}
      />
    </div>
  )
}

export default App
