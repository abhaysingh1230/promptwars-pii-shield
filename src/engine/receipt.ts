import type { BenchmarkReport } from './benchmark'
import type { PiiCategory, RedactionMode, SanitizeResult } from './types'

export interface PrivacyReceipt {
  schemaVersion: '1.0'
  receiptStatement: string
  generatedAt: string
  executionScope: 'Local browser memory only'
  redactionMode: RedactionMode
  inputFormat: 'txt' | 'csv'
  processingMs: number
  totalEntitiesRedacted: number
  countsByCategory: Record<PiiCategory, number>
  validationSummary: {
    luhnVerifiedCards: number
    luhnRejectedCandidates: number
    aadhaarVerhoeffVerified: number
    aadhaarFormatMatchedUnverified: number
    phoneNumberingPlanVerified: number
    ipStandardsValidated: number
    panAndEmailFormatMatched: number
    customRe2Matches: number
  }
  benchmark:
    | {
        executed: true
        version: string
        isSynthetic: true
        passedCases: number
        failedCases: number
        totalCases: number
        falsePositives: number
        falseNegatives: number
        durationMs: number
      }
    | {
        executed: false
        version: string
        note: string
      }
}

export function buildPrivacyReceipt(params: {
  result: SanitizeResult
  mode: RedactionMode
  inputFormat: 'txt' | 'csv'
  benchmarkReport: BenchmarkReport | null
  generatedAt?: string
}): PrivacyReceipt {
  const { result, mode, inputFormat, benchmarkReport } = params

  let aadhaarVerhoeffVerified = 0
  let aadhaarFormatMatchedUnverified = 0
  for (const entity of result.entities) {
    if (entity.category === 'aadhaar') {
      if (entity.validationNote === 'Verhoeff checksum verified') {
        aadhaarVerhoeffVerified += 1
      } else {
        aadhaarFormatMatchedUnverified += 1
      }
    }
  }

  return {
    schemaVersion: '1.0',
    receiptStatement:
      'This Privacy Receipt contains safe sanitization metadata only. No original PII, raw input text, detected values, masked fragments, or unsanitized filenames are included.',
    generatedAt: params.generatedAt ?? new Date().toISOString(),
    executionScope: 'Local browser memory only',
    redactionMode: mode,
    inputFormat,
    processingMs: result.processingMs,
    totalEntitiesRedacted: result.totalEntities,
    countsByCategory: { ...result.countsByCategory },
    validationSummary: {
      luhnVerifiedCards: result.countsByCategory.credit_card,
      luhnRejectedCandidates: result.luhnRejected.length,
      aadhaarVerhoeffVerified,
      aadhaarFormatMatchedUnverified,
      phoneNumberingPlanVerified: result.countsByCategory.phone,
      ipStandardsValidated: result.countsByCategory.ip_address,
      panAndEmailFormatMatched:
        result.countsByCategory.pan + result.countsByCategory.email,
      customRe2Matches: result.countsByCategory.custom,
    },
    benchmark: benchmarkReport
      ? {
          executed: true,
          version: benchmarkReport.benchmarkVersion,
          isSynthetic: true,
          passedCases: benchmarkReport.passedCases,
          failedCases: benchmarkReport.failedCases,
          totalCases: benchmarkReport.totalCases,
          falsePositives: benchmarkReport.falsePositives,
          falseNegatives: benchmarkReport.falseNegatives,
          durationMs: benchmarkReport.durationMs,
        }
      : {
          executed: false,
          version: '2026.1',
          note: 'Run privacy benchmark in-app to record synthetic suite metrics in this receipt.',
        },
  }
}
