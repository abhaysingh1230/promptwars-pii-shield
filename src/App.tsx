import { useEffect, useMemo, useRef, useState } from 'react'
import { ComplianceBanner } from './components/ComplianceBanner'
import { ControlsBar } from './components/ControlsBar'
import { DiffViewer } from './components/DiffViewer'
import { Header } from './components/Header'
import { PromptLogModal } from './components/PromptLogModal'
import { SecurityWorkbench } from './components/SecurityWorkbench'
import { SAMPLE_DATASETS, type SampleDataset } from './data/samples'
import {
  detectOnDeviceAiStatus,
  generateOnDevicePrivacySummary,
  type OnDeviceAdviceResult,
} from './engine/chromeAi'
import { assessPrivacyRisk } from './engine/compliance'
import { sanitizeCsvDocument } from './engine/csv'
import { sanitizeText } from './engine/detector'
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
  const [rawInput, setRawInput] = useState<string>(SAMPLE_DATASETS[0].content)
  const [inputFormat, setInputFormat] = useState<'txt' | 'csv'>('txt')
  const [activeFileName, setActiveFileName] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [mode, setMode] = useState<RedactionMode>('partial')
  const [fullMaskStyle, setFullMaskStyle] = useState<FullMaskStyle>('generic')
  const [enabledCategories, setEnabledCategories] = useState<
    Record<PiiCategory, boolean>
  >({ ...DEFAULT_ENABLED_CATEGORIES })
  const [customRules, setCustomRules] = useState<CustomRule[]>([])
  const [promptLogOpen, setPromptLogOpen] = useState(false)
  const [onDeviceAiStatus, setOnDeviceAiStatus] = useState<
    'available' | 'unavailable'
  >('unavailable')
  const [privacyAdvice, setPrivacyAdvice] =
    useState<OnDeviceAdviceResult | null>(null)
  const [workerResult, setWorkerResult] = useState<SanitizeResult | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const workerReqIdRef = useRef(0)

  const useBackgroundWorker =
    typeof Worker !== 'undefined' && rawInput.length >= WORKER_THRESHOLD_CHARS

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

    const handleMessage = (event: MessageEvent<SanitizeWorkerResponse>) => {
      if (event.data.requestId === workerReqIdRef.current) {
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
    worker.postMessage(payload)

    return () => {
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
          'No sensitive PII entities were detected in this payload. Safe to review and export locally.',
      }
    }
    const complianceNote =
      highRiskCount > 0
        ? `Detected ${highRiskCount} high-sensitivity financial/government IDs (PCI-DSS / DPDP Act scope)`
        : `Detected ${total} contact/network identifiers`
    const luhnNote =
      result.luhnRejected.length > 0
        ? ` and filtered ${result.luhnRejected.length} non-Luhn 16-digit false positive(s).`
        : '.'
    return {
      source: 'local-engine',
      summary: `${complianceNote}${luhnNote} All ${total} entities were sanitized in-browser under "${mode}" mode with zero server transmission.`,
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
    const mime =
      inputFormat === 'csv'
        ? 'text/csv;charset=utf-8'
        : 'text/plain;charset=utf-8'
    triggerClientDownload(result.sanitizedText, downloadFileName, mime)
  }

  function handleDownloadAuditJson() {
    const safeReport = {
      generatedAt: new Date().toISOString(),
      executionMode: '100% client-side (zero external transmission)',
      redactionMode: mode,
      inputFormat,
      riskScoreBefore: complianceAssessment.rawRiskScore,
      riskScoreAfter: complianceAssessment.sanitizedRiskScore,
      totalEntitiesRedacted: result.totalEntities,
      countsByCategory: result.countsByCategory,
      luhnFalsePositivesRejected: result.luhnRejected.map((r) => ({
        length: r.digits.length,
        reason: r.reason,
      })),
      pseudonymRegistry: result.pseudonyms.map((p) => ({
        pseudonym: p.pseudonym,
        category: p.category,
        maskedReference: p.previewMasked,
        occurrences: p.occurrences,
      })),
    }
    triggerClientDownload(
      JSON.stringify(safeReport, null, 2),
      'pii-audit-report.json',
      'application/json;charset=utf-8'
    )
  }

  return (
    <div className="bg-cyber-grid min-h-screen text-slate-100">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-cyan-400 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-slate-950"
      >
        Skip to sanitization workspace
      </a>

      <Header
        onOpenPromptLog={() => setPromptLogOpen(true)}
        onDeviceAiStatus={onDeviceAiStatus}
      />

      <main
        id="main-content"
        className="mx-auto max-w-7xl space-y-4 px-4 py-5 sm:px-6"
      >
        <ComplianceBanner assessment={complianceAssessment} />

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
          activeFileName={activeFileName}
          uploadError={uploadError}
        />

        <DiffViewer
          rawInput={rawInput}
          onRawInputChange={handleRawInputChange}
          result={result}
          downloadFileName={downloadFileName}
          onDownloadSanitized={handleDownloadSanitized}
        />

        <SecurityWorkbench
          result={result}
          mode={mode}
          privacyAdvice={activePrivacyAdvice}
          customRules={customRules}
          onAddCustomRule={handleAddCustomRule}
          onToggleCustomRule={handleToggleCustomRule}
          onDeleteCustomRule={handleDeleteCustomRule}
          onDownloadAuditJson={handleDownloadAuditJson}
        />
      </main>

      <PromptLogModal
        open={promptLogOpen}
        onClose={() => setPromptLogOpen(false)}
      />
    </div>
  )
}

export default App
