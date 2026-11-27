import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { validateCustomRegex } from '../../engine/detector'
import type { CustomRule } from '../../engine/types'

const PRESET_CUSTOM_RULES: ReadonlyArray<Omit<CustomRule, 'id' | 'enabled'>> = [
  {
    label: 'Indian IFSC Code',
    pattern: '\\b[A-Z]{4}0[A-Z0-9]{6}\\b',
    tokenPrefix: 'IFSC',
  },
  {
    label: 'API / Secret Key',
    pattern: '\\b(?:sk|pk|AIza)[_-]?[A-Za-z0-9_-]{16,}\\b',
    tokenPrefix: 'APIKEY',
  },
  {
    label: 'Employee ID',
    pattern: '\\bEMP-\\d{3,6}\\b',
    tokenPrefix: 'EMPID',
  },
]

interface CustomRulesPanelProps {
  customRules: CustomRule[]
  customRuleWarning: string | null
  onAddCustomRule: (rule: CustomRule) => void
  onToggleCustomRule: (id: string) => void
  onDeleteCustomRule: (id: string) => void
}

/**
 * Configures user-defined RE2 linear-time regex rules executed inside the Web Worker.
 */
export function CustomRulesPanel({
  customRules,
  customRuleWarning,
  onAddCustomRule,
  onToggleCustomRule,
  onDeleteCustomRule,
}: CustomRulesPanelProps) {
  const [label, setLabel] = useState('')
  const [pattern, setPattern] = useState('')
  const [ruleError, setRuleError] = useState<string | null>(null)

  function handleAddRule() {
    const cleanLabel = label.trim()
    const cleanPattern = pattern.trim()
    if (!cleanLabel) {
      setRuleError('Provide a short rule label (e.g. Employee ID)')
      return
    }
    const regexErr = validateCustomRegex(cleanPattern)
    if (regexErr) {
      setRuleError(regexErr)
      return
    }
    setRuleError(null)
    onAddCustomRule({
      id: `rule-${Date.now()}`,
      label: cleanLabel,
      pattern: cleanPattern,
      tokenPrefix:
        cleanLabel
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '')
          .slice(0, 8) || 'CUSTOM',
      enabled: true,
    })
    setLabel('')
    setPattern('')
  }

  function handleAddPreset(preset: Omit<CustomRule, 'id' | 'enabled'>) {
    if (customRules.some((r) => r.pattern === preset.pattern)) return
    onAddCustomRule({
      ...preset,
      id: `preset-${preset.tokenPrefix}-${Date.now()}`,
      enabled: true,
    })
  }

  return (
    <div
      id="panel-rules"
      role="tabpanel"
      aria-labelledby="tab-rules"
      className="space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[var(--text-secondary)]">
          Custom rules compile with Google&apos;s RE2 linear-time engine (re2js)
          inside a Web Worker with an 800 ms watchdog.
        </p>
        <div className="flex flex-wrap gap-2">
          {PRESET_CUSTOM_RULES.map((preset) => (
            <button
              key={preset.tokenPrefix}
              type="button"
              onClick={() => handleAddPreset(preset)}
              className="transition-ui h-8 rounded-md border border-[var(--border-strong)] bg-[var(--bg-panel)] px-2.5 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--border-accent)]"
            >
              + {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-12">
        <input
          type="text"
          aria-label="Custom rule label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Rule label"
          className="h-9 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-recessed)] px-3 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-solid)] focus:outline-none sm:col-span-4"
        />
        <input
          type="text"
          aria-label="Custom rule regex pattern"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          placeholder="RE2 pattern (linear-time O(n))"
          className="h-9 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-recessed)] px-3 font-mono text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-solid)] focus:outline-none sm:col-span-6"
        />
        <button
          type="button"
          onClick={handleAddRule}
          className="transition-ui inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[var(--cta-solid)] px-3 text-xs font-medium text-[var(--cta-solid-text)] hover:bg-[var(--cta-solid-hover)] sm:col-span-2"
        >
          <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
          <span>Add</span>
        </button>
      </div>

      {(ruleError || customRuleWarning) && (
        <p role="alert" className="text-xs text-[var(--text-danger)]">
          {ruleError ?? customRuleWarning}
        </p>
      )}

      {customRules.length === 0 ? (
        <p className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-recessed)] p-3 text-xs text-[var(--text-muted)]">
          No custom rules active yet. Choose a preset above or add a safe regex
          pattern.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {customRules.map((rule) => (
            <li
              key={rule.id}
              className="flex h-10 items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-recessed)] px-3 text-xs"
            >
              <label className="flex min-w-0 cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={() => onToggleCustomRule(rule.id)}
                  className="h-3.5 w-3.5 rounded border-[var(--border-strong)] bg-[var(--bg-modal)] accent-[var(--accent-solid)]"
                />
                <span className="font-medium text-[var(--text-primary)]">
                  {rule.label}
                </span>
                <code className="truncate font-mono text-xs text-[var(--text-muted)]">
                  /{rule.pattern}/g
                </code>
              </label>
              <button
                type="button"
                onClick={() => onDeleteCustomRule(rule.id)}
                aria-label={`Remove custom rule ${rule.label}`}
                className="text-[var(--text-muted)] hover:text-[var(--text-danger)]"
              >
                <Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
