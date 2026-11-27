import type { PiiCategory, SanitizeResult } from './types'

export interface ComplianceFrameworkStatus {
  id: 'pci_dss' | 'dpdp_india' | 'gdpr_contact'
  label: string
  findingsBefore: number
  mitigatedAfter: number
  status: 'protected' | 'clear'
}

export interface PrivacyRiskAssessment {
  rawRiskScore: number
  sanitizedRiskScore: number
  severityLabel: 'Clear' | 'Low' | 'Moderate' | 'High' | 'Critical'
  frameworks: ComplianceFrameworkStatus[]
  throughputMbPerSec: number
}

const CATEGORY_WEIGHTS: Record<PiiCategory, number> = {
  credit_card: 28,
  aadhaar: 24,
  pan: 20,
  email: 8,
  phone: 10,
  ip_address: 6,
  custom: 14,
}

/**
 * Computes a local heuristic exposure estimate before vs. after pattern redaction.
 * Represents pattern coverage under active rules, not a formal compliance certification.
 */
export function assessPrivacyRisk(result: SanitizeResult): PrivacyRiskAssessment {
  const counts = result.countsByCategory

  let weightedScore = 0
  for (const [cat, weight] of Object.entries(CATEGORY_WEIGHTS) as Array<
    [PiiCategory, number]
  >) {
    const c = counts[cat]
    if (c > 0) {
      weightedScore += weight + Math.min(12, (c - 1) * 3)
    }
  }

  const rawRiskScore = Math.min(100, weightedScore)
  const sanitizedRiskScore = 0

  let severityLabel: PrivacyRiskAssessment['severityLabel'] = 'Clear'
  if (rawRiskScore >= 75) severityLabel = 'Critical'
  else if (rawRiskScore >= 50) severityLabel = 'High'
  else if (rawRiskScore >= 25) severityLabel = 'Moderate'
  else if (rawRiskScore > 0) severityLabel = 'Low'

  const pciFindings = counts.credit_card
  const dpdpFindings = counts.aadhaar + counts.pan
  const contactFindings = counts.email + counts.phone + counts.ip_address

  const frameworks: ComplianceFrameworkStatus[] = [
    {
      id: 'pci_dss',
      label: 'Payment Card Patterns',
      findingsBefore: pciFindings,
      mitigatedAfter: pciFindings,
      status: pciFindings > 0 ? 'protected' : 'clear',
    },
    {
      id: 'dpdp_india',
      label: 'Indian Gov ID Patterns',
      findingsBefore: dpdpFindings,
      mitigatedAfter: dpdpFindings,
      status: dpdpFindings > 0 ? 'protected' : 'clear',
    },
    {
      id: 'gdpr_contact',
      label: 'Contact & Network Patterns',
      findingsBefore: contactFindings,
      mitigatedAfter: contactFindings,
      status: contactFindings > 0 ? 'protected' : 'clear',
    },
  ]

  const bytes = new Blob([result.originalText]).size
  const elapsedSec = Math.max(result.processingMs / 1000, 0.0005)
  const throughputMbPerSec = Number((bytes / (1024 * 1024) / elapsedSec).toFixed(2))

  return {
    rawRiskScore,
    sanitizedRiskScore,
    severityLabel,
    frameworks,
    throughputMbPerSec,
  }
}
