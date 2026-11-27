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
  dotClass: string
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
    label: 'Credit card',
    shortLabel: 'CARD',
    priority: 1,
    dotClass: 'bg-[#e5484d]',
    badgeClass: 'border-[#eef0f5]/10 bg-[#1a1e28] text-[#eef0f5]',
    highlightClass: 'bg-[#e5484d]/15 text-[#eef0f5] border-b border-[#e5484d]',
    redactedClass: 'bg-[#1a1e28] text-[#eef0f5] border border-[#e5484d]/45',
    description: '13–19 digit payment cards verified with Luhn mod-10 checksum',
  },
  email: {
    id: 'email',
    label: 'Email address',
    shortLabel: 'EMAIL',
    priority: 2,
    dotClass: 'bg-[#38bdf8]',
    badgeClass: 'border-[#eef0f5]/10 bg-[#1a1e28] text-[#eef0f5]',
    highlightClass: 'bg-[#38bdf8]/15 text-[#eef0f5] border-b border-[#38bdf8]',
    redactedClass: 'bg-[#1a1e28] text-[#eef0f5] border border-[#38bdf8]/45',
    description: 'Personal and corporate email addresses',
  },
  pan: {
    id: 'pan',
    label: 'Indian PAN',
    shortLabel: 'PAN',
    priority: 3,
    dotClass: 'bg-[#f59e0b]',
    badgeClass: 'border-[#eef0f5]/10 bg-[#1a1e28] text-[#eef0f5]',
    highlightClass: 'bg-[#f59e0b]/15 text-[#eef0f5] border-b border-[#f59e0b]',
    redactedClass: 'bg-[#1a1e28] text-[#eef0f5] border border-[#f59e0b]/45',
    description: 'Permanent Account Number (ABCDE1234F format)',
  },
  aadhaar: {
    id: 'aadhaar',
    label: 'Indian Aadhaar',
    shortLabel: 'AADHAAR',
    priority: 4,
    dotClass: 'bg-[#a78bfa]',
    badgeClass: 'border-[#eef0f5]/10 bg-[#1a1e28] text-[#eef0f5]',
    highlightClass: 'bg-[#a78bfa]/15 text-[#eef0f5] border-b border-[#a78bfa]',
    redactedClass: 'bg-[#1a1e28] text-[#eef0f5] border border-[#a78bfa]/45',
    description: '12-digit UIDAI Aadhaar format (spaced, hyphenated, or continuous)',
  },
  ip_address: {
    id: 'ip_address',
    label: 'IP address',
    shortLabel: 'IP',
    priority: 5,
    dotClass: 'bg-[#4cc38a]',
    badgeClass: 'border-[#eef0f5]/10 bg-[#1a1e28] text-[#eef0f5]',
    highlightClass: 'bg-[#4cc38a]/15 text-[#eef0f5] border-b border-[#4cc38a]',
    redactedClass: 'bg-[#1a1e28] text-[#eef0f5] border border-[#4cc38a]/45',
    description: 'IPv4 (0–255 octets) and IPv6 network addresses',
  },
  phone: {
    id: 'phone',
    label: 'Phone number',
    shortLabel: 'PHONE',
    priority: 6,
    dotClass: 'bg-[#2dd4bf]',
    badgeClass: 'border-[#eef0f5]/10 bg-[#1a1e28] text-[#eef0f5]',
    highlightClass: 'bg-[#2dd4bf]/15 text-[#eef0f5] border-b border-[#2dd4bf]',
    redactedClass: 'bg-[#1a1e28] text-[#eef0f5] border border-[#2dd4bf]/45',
    description: 'Indian (+91 / 10-digit) and international telephone numbers',
  },
  custom: {
    id: 'custom',
    label: 'Custom rules',
    shortLabel: 'CUSTOM',
    priority: 7,
    dotClass: 'bg-[#e879f9]',
    badgeClass: 'border-[#eef0f5]/10 bg-[#1a1e28] text-[#eef0f5]',
    highlightClass: 'bg-[#e879f9]/15 text-[#eef0f5] border-b border-[#e879f9]',
    redactedClass: 'bg-[#1a1e28] text-[#eef0f5] border border-[#e879f9]/45',
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
