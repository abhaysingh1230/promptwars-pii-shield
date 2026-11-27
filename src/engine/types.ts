export type PiiCategory =
  | 'credit_card'
  | 'pan'
  | 'aadhaar'
  | 'email'
  | 'phone'
  | 'ip_address'
  | 'custom'

export type BuiltinPiiCategory = Exclude<PiiCategory, 'custom'>

export type RedactionMode = 'full' | 'partial' | 'pseudonym'

export type FullMaskStyle = 'generic' | 'typed'

export interface CustomRule {
  id: string
  label: string
  pattern: string
  tokenPrefix: string
  enabled: boolean
}

export interface CategoryMeta {
  id: PiiCategory
  label: string
  shortLabel: string
  priority: number
  badgeClass: string
  highlightClass: string
  redactedClass: string
  description: string
}

export const ALL_CATEGORIES: readonly PiiCategory[] = [
  'credit_card',
  'pan',
  'aadhaar',
  'email',
  'phone',
  'ip_address',
  'custom',
] as const

export const BUILTIN_CATEGORIES: readonly BuiltinPiiCategory[] = [
  'credit_card',
  'pan',
  'aadhaar',
  'email',
  'phone',
  'ip_address',
] as const

export const PII_CATEGORY_META: Record<PiiCategory, CategoryMeta> = {
  credit_card: {
    id: 'credit_card',
    label: 'Credit Card',
    shortLabel: 'CARD',
    priority: 1,
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
    highlightClass: 'bg-rose-500/20 text-rose-200 border-b-2 border-rose-400',
    redactedClass: 'bg-rose-950/70 text-rose-200 border border-rose-500/40',
    description: '13–19 digit payment cards verified with Luhn mod-10 checksum',
  },
  email: {
    id: 'email',
    label: 'Email Address',
    shortLabel: 'EMAIL',
    priority: 2,
    badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
    highlightClass: 'bg-sky-500/20 text-sky-200 border-b-2 border-sky-400',
    redactedClass: 'bg-sky-950/70 text-sky-200 border border-sky-500/40',
    description: 'Personal and corporate email addresses',
  },
  pan: {
    id: 'pan',
    label: 'Indian PAN',
    shortLabel: 'PAN',
    priority: 3,
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
    highlightClass: 'bg-amber-500/20 text-amber-200 border-b-2 border-amber-400',
    redactedClass: 'bg-amber-950/70 text-amber-200 border border-amber-500/40',
    description: 'Permanent Account Number (ABCDE1234F format)',
  },
  aadhaar: {
    id: 'aadhaar',
    label: 'Indian Aadhaar',
    shortLabel: 'AADHAAR',
    priority: 4,
    badgeClass: 'bg-violet-500/15 text-violet-300 border-violet-500/40',
    highlightClass: 'bg-violet-500/20 text-violet-200 border-b-2 border-violet-400',
    redactedClass: 'bg-violet-950/70 text-violet-200 border border-violet-500/40',
    description: '12-digit UIDAI Aadhaar format (spaced, hyphenated, or continuous)',
  },
  ip_address: {
    id: 'ip_address',
    label: 'IP Address',
    shortLabel: 'IP',
    priority: 5,
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    highlightClass: 'bg-emerald-500/20 text-emerald-200 border-b-2 border-emerald-400',
    redactedClass: 'bg-emerald-950/70 text-emerald-200 border border-emerald-500/40',
    description: 'IPv4 (0–255 octets) and IPv6 network addresses',
  },
  phone: {
    id: 'phone',
    label: 'Phone Number',
    shortLabel: 'PHONE',
    priority: 6,
    badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40',
    highlightClass: 'bg-cyan-500/20 text-cyan-200 border-b-2 border-cyan-400',
    redactedClass: 'bg-cyan-950/70 text-cyan-200 border border-cyan-500/40',
    description: 'Indian (+91 / 10-digit) and international telephone numbers',
  },
  custom: {
    id: 'custom',
    label: 'Custom Rules',
    shortLabel: 'CUSTOM',
    priority: 7,
    badgeClass: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/40',
    highlightClass: 'bg-fuchsia-500/20 text-fuchsia-200 border-b-2 border-fuchsia-400',
    redactedClass: 'bg-fuchsia-950/70 text-fuchsia-200 border border-fuchsia-500/40',
    description: 'User-defined client-side regex rules (API keys, IFSC, employee IDs)',
  },
}

export const DEFAULT_ENABLED_CATEGORIES: Record<PiiCategory, boolean> = {
  credit_card: true,
  pan: true,
  aadhaar: true,
  email: true,
  phone: true,
  ip_address: true,
  custom: true,
}

export interface PiiCandidate {
  category: PiiCategory
  raw: string
  normalized: string
  start: number
  end: number
  confidence: 'high' | 'medium'
  validationNote?: string
}

export interface PiiEntity extends PiiCandidate {
  id: string
  replacement: string
}

export interface LuhnRejectedCandidate {
  raw: string
  digits: string
  start: number
  end: number
  reason: string
}

export interface PseudonymMapping {
  category: PiiCategory
  normalizedKey: string
  previewMasked: string
  pseudonym: string
  occurrences: number
}

export interface DiffSegment {
  type: 'text' | 'entity'
  text: string
  entity?: PiiEntity
}

export interface SanitizeOptions {
  mode: RedactionMode
  enabledCategories: Record<PiiCategory, boolean>
  fullMaskStyle?: FullMaskStyle
  isCsv?: boolean
  customRules?: CustomRule[]
}

export interface SanitizeResult {
  originalText: string
  sanitizedText: string
  entities: PiiEntity[]
  luhnRejected: LuhnRejectedCandidate[]
  countsByCategory: Record<PiiCategory, number>
  totalEntities: number
  pseudonyms: PseudonymMapping[]
  originalSegments: DiffSegment[]
  sanitizedSegments: DiffSegment[]
  processingMs: number
  isCsv: boolean
  csvRowCount?: number
  csvColCount?: number
}
