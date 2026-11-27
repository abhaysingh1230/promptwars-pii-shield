import type { PiiCategory, RedactionMode } from './types'

/**
 * Optional 100% on-device Chrome Built-in AI (Gemini Nano) helper.
 * Never receives raw PII — only receives aggregate entity counts after local redaction.
 * Falls back cleanly to deterministic compliance guidance when unavailable.
 */

interface ChromeLanguageModelSession {
  prompt: (input: string) => Promise<string>
  destroy?: () => void
}

interface ChromeLanguageModelGlobal {
  availability?: () => Promise<'available' | 'downloadable' | 'downloading' | 'unavailable'>
  create?: (opts?: { systemPrompt?: string }) => Promise<ChromeLanguageModelSession>
}

export interface OnDeviceAdviceResult {
  source: 'gemini-nano' | 'local-engine'
  summary: string
}

function getChromeLanguageModel(): ChromeLanguageModelGlobal | null {
  const g = globalThis as unknown as {
    LanguageModel?: ChromeLanguageModelGlobal
    ai?: { languageModel?: ChromeLanguageModelGlobal }
  }
  return g.LanguageModel ?? g.ai?.languageModel ?? null
}

export async function detectOnDeviceAiStatus(): Promise<
  'available' | 'unavailable'
> {
  try {
    const lm = getChromeLanguageModel()
    if (!lm?.availability || !lm.create) return 'unavailable'
    const status = await lm.availability()
    return status === 'available' ? 'available' : 'unavailable'
  } catch {
    return 'unavailable'
  }
}

export async function generateOnDevicePrivacySummary(
  counts: Record<PiiCategory, number>,
  luhnRejectedCount: number,
  mode: RedactionMode
): Promise<OnDeviceAdviceResult> {
  const summaryPrompt =
    `Summarize data privacy risk in 2 concise sentences based only on redacted counts (no PII provided): ` +
    `credit_cards=${counts.credit_card}, pan=${counts.pan}, aadhaar=${counts.aadhaar}, ` +
    `emails=${counts.email}, phones=${counts.phone}, ips=${counts.ip_address}, ` +
    `luhn_false_positives_filtered=${luhnRejectedCount}, active_mode=${mode}.`

  try {
    const lm = getChromeLanguageModel()
    if (lm?.availability && lm.create) {
      const avail = await lm.availability()
      if (avail === 'available') {
        const session = await lm.create({
          systemPrompt:
            'You are a concise cybersecurity compliance advisor. Respond in 2 short sentences.',
        })
        try {
          const text = await session.prompt(summaryPrompt)
          if (text.trim()) {
            return { source: 'gemini-nano', summary: text.trim() }
          }
        } finally {
          session.destroy?.()
        }
      }
    }
  } catch {
    // Gracefully fall back to deterministic local engine below
  }

  const highRiskCount =
    counts.credit_card + counts.pan + counts.aadhaar
  const total =
    highRiskCount + counts.email + counts.phone + counts.ip_address

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
    luhnRejectedCount > 0
      ? ` and filtered ${luhnRejectedCount} non-Luhn 16-digit false positive(s).`
      : '.'

  return {
    source: 'local-engine',
    summary: `${complianceNote}${luhnNote} All ${total} entities were sanitized in-browser under "${mode}" mode with zero server transmission.`,
  }
}
