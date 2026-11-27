import { ArrowRight, Gauge, ShieldCheck, Zap } from 'lucide-react'
import type { PrivacyRiskAssessment } from '../engine/compliance'

interface ComplianceBannerProps {
  assessment: PrivacyRiskAssessment
}

const SEVERITY_STYLES: Record<
  PrivacyRiskAssessment['severityLabel'],
  string
> = {
  Clear: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  Low: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  Moderate: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  High: 'border-orange-500/40 bg-orange-500/10 text-orange-300',
  Critical: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
}

export function ComplianceBanner({ assessment }: ComplianceBannerProps) {
  return (
    <section
      aria-label="Compliance and Privacy Risk Assessment"
      className="flex flex-col gap-3 rounded-2xl border border-slate-800/90 bg-slate-900/65 px-4 py-3 ring-1 ring-white/[0.03] backdrop-blur lg:flex-row lg:items-center lg:justify-between"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-950">
          <Gauge className="h-4 w-4 text-cyan-400" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-300">
              Exposure Score
            </span>
            <span
              className={`rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold ${
                SEVERITY_STYLES[assessment.severityLabel]
              }`}
            >
              {assessment.rawRiskScore}/100 • {assessment.severityLabel}
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            <span className="rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-300">
              {assessment.sanitizedRiskScore}/100 Sanitized
            </span>
          </div>
          <div
            aria-hidden="true"
            className="mt-1.5 h-1.5 w-52 max-w-full overflow-hidden rounded-full bg-slate-800"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500 transition-all duration-300"
              style={{ width: `${assessment.rawRiskScore}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {assessment.frameworks.map((fw) => (
          <div
            key={fw.id}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium ${
              fw.status === 'protected'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                : 'border-slate-800 bg-slate-950/60 text-slate-400'
            }`}
          >
            <ShieldCheck className="h-3 w-3 text-emerald-400" aria-hidden="true" />
            <span>{fw.label}:</span>
            <span className="font-mono font-semibold">
              {fw.findingsBefore > 0
                ? `${fw.mitigatedAfter} mitigated`
                : 'Clear'}
            </span>
          </div>
        ))}

        <div className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950/70 px-2.5 py-1 font-mono text-[11px] text-amber-300">
          <Zap className="h-3 w-3" aria-hidden="true" />
          <span>{assessment.throughputMbPerSec} MB/s</span>
        </div>
      </div>
    </section>
  )
}
