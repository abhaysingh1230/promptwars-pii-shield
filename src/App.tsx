import { useEffect, useMemo, useState } from 'react'
import { AuditPanel } from './components/AuditPanel'
import { ControlsBar } from './components/ControlsBar'
import { DiffViewer } from './components/DiffViewer'
import { Header } from './components/Header'
import { PromptLogModal } from './components/PromptLogModal'
import { SAMPLE_DATASETS, type SampleDataset } from './data/samples'
import {
  detectOnDeviceAiStatus,
  generateOnDevicePrivacySummary,
  type OnDeviceAdviceResult,
} from './engine/chromeAi'
import { sanitizeCsvDocument } from './engine/csv'
import { sanitizeText } from './engine/detector'
import {
  DEFAULT_ENABLED_CATEGORIES,
  type FullMaskStyle,
  type PiiCategory,
  type RedactionMode,
} from './engine/types'

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

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
  const [promptLogOpen, setPromptLogOpen] = useState(false)
  const [onDeviceAiStatus, setOnDeviceAiStatus] = useState<
    'available' | 'unavailable'
  >('unavailable')
  const [privacyAdvice, setPrivacyAdvice] =
    useState<OnDeviceAdviceResult | null>(null)

  const result = useMemo(() => {
    const options = {
      mode,
      enabledCategories,
      fullMaskStyle,
      isCsv: inputFormat === 'csv',
    }
    return inputFormat === 'csv'
      ? sanitizeCsvDocument(rawInput, options)
      : sanitizeText(rawInput, options)
  }, [rawInput, inputFormat, mode, enabledCategories, fullMaskStyle])

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
  }, [result.countsByCategory, result.totalEntities, result.luhnRejected.length, mode])

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
    <div className="min-h-screen bg-slate-950 text-slate-100">
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
        className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6"
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

        <AuditPanel
          result={result}
          mode={mode}
          privacyAdvice={activePrivacyAdvice}
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
