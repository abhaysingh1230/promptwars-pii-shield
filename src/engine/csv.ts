import { sanitizeText } from './detector'
import { PseudonymRegistry } from './redactors'
import {
  ALL_CATEGORIES,
  type DiffSegment,
  type LuhnRejectedCandidate,
  type PiiCategory,
  type PiiEntity,
  type SanitizeOptions,
  type SanitizeResult,
} from './types'

export interface CsvParseValidationResult {
  ok: boolean
  rows: string[][]
  error?: string
}

const FORMULA_TRIGGER_CHARS = new Set(['=', '+', '-', '@'])

/**
 * Prevents spreadsheet formula execution (=, +, -, @, tab, CR, or leading whitespace/control chars
 * followed by a formula trigger) when sanitized CSV exports are opened in Excel or Google Sheets.
 */
export function escapeCsvFormula(value: string): string {
  if (!value) return value
  if (value.startsWith('\t') || value.startsWith('\r')) {
    return `'${value}`
  }

  let i = 0
  while (i < value.length) {
    const code = value.charCodeAt(i)
    const ch = value[i]
    if (code <= 0x20 || /\s/.test(ch)) {
      i++
      continue
    }
    if (FORMULA_TRIGGER_CHARS.has(ch)) {
      return `'${value}`
    }
    break
  }

  return value
}

/**
 * Strictly parses RFC-4180 CSV content and explicitly detects malformed quoting:
 * - Unterminated quoted fields at EOF
 * - Unescaped quotes inside unquoted fields
 * - Non-delimiter characters following a closing quote
 */
export function parseCsvStrict(input: string): CsvParseValidationResult {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentCell = ''
  let inQuotes = false
  let justClosedQuote = false
  let cellStart = true
  let line = 1

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    const next = input[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentCell += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
        justClosedQuote = true
      } else {
        if (ch === '\n') line++
        currentCell += ch
      }
      continue
    }

    if (justClosedQuote) {
      if (ch === ',') {
        currentRow.push(currentCell)
        currentCell = ''
        justClosedQuote = false
        cellStart = true
        continue
      }
      if (ch === '\r' && next === '\n') {
        currentRow.push(currentCell)
        rows.push(currentRow)
        currentRow = []
        currentCell = ''
        justClosedQuote = false
        cellStart = true
        line++
        i++
        continue
      }
      if (ch === '\n' || ch === '\r') {
        currentRow.push(currentCell)
        rows.push(currentRow)
        currentRow = []
        currentCell = ''
        justClosedQuote = false
        cellStart = true
        line++
        continue
      }
      return {
        ok: false,
        rows: [],
        error: `Malformed CSV at line ${line}: unexpected character "${ch}" after closing quote.`,
      }
    }

    if (ch === '"') {
      if (!cellStart) {
        return {
          ok: false,
          rows: [],
          error: `Malformed CSV at line ${line}: unescaped quote inside unquoted cell.`,
        }
      }
      inQuotes = true
      cellStart = false
    } else if (ch === ',') {
      currentRow.push(currentCell)
      currentCell = ''
      cellStart = true
    } else if (ch === '\r' && next === '\n') {
      currentRow.push(currentCell)
      rows.push(currentRow)
      currentRow = []
      currentCell = ''
      cellStart = true
      line++
      i++
    } else if (ch === '\n' || ch === '\r') {
      currentRow.push(currentCell)
      rows.push(currentRow)
      currentRow = []
      currentCell = ''
      cellStart = true
      line++
    } else {
      currentCell += ch
      cellStart = false
    }
  }

  if (inQuotes) {
    return {
      ok: false,
      rows: [],
      error: `Malformed CSV: unterminated quoted cell starting before line ${line}.`,
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0 || justClosedQuote) {
    currentRow.push(currentCell)
    rows.push(currentRow)
  }

  return { ok: true, rows }
}

/**
 * Convenience parser returning rows (or empty array if invalid).
 */
export function parseCsv(input: string): string[][] {
  const parsed = parseCsvStrict(input)
  return parsed.ok ? parsed.rows : []
}

/**
 * Escapes and formats a cell value according to RFC-4180 CSV quoting rules.
 */
export function formatCsvCell(
  value: string,
  escapeFormulas = false
): string {
  const safeVal = escapeFormulas ? escapeCsvFormula(value) : value
  if (/[",\r\n]/.test(safeVal)) {
    return `"${safeVal.replace(/"/g, '""')}"`
  }
  return safeVal
}

export function serializeCsv(
  rows: string[][],
  options: { escapeFormulas?: boolean } = {}
): string {
  const escapeFormulas = Boolean(options.escapeFormulas)
  return rows
    .map((row) => row.map((cell) => formatCsvCell(cell, escapeFormulas)).join(','))
    .join('\n')
}

/**
 * Sanitizes CSV cell-by-cell while preserving row/column boundaries and
 * escaping formula-leading characters in downloadable CSV output.
 */
export function sanitizeCsvDocument(
  csvText: string,
  options: SanitizeOptions
): SanitizeResult {
  const startTime = performance.now()
  const parsed = parseCsvStrict(csvText)

  if (!parsed.ok) {
    const emptyResult = sanitizeText('', { ...options, isCsv: true })
    return {
      ...emptyResult,
      originalText: csvText,
      sanitizedText: '',
      isCsv: true,
      csvRowCount: 0,
      csvColCount: 0,
      csvParseError: parsed.error,
      processingMs: Number((performance.now() - startTime).toFixed(2)),
    }
  }

  const rows = parsed.rows
  const sharedRegistry = new PseudonymRegistry()

  const countsByCategory: Record<PiiCategory, number> = {
    credit_card: 0,
    pan: 0,
    aadhaar: 0,
    email: 0,
    phone: 0,
    ip_address: 0,
    custom: 0,
  }

  const allEntities: PiiEntity[] = []
  const allLuhnRejected: LuhnRejectedCandidate[] = []
  const originalSegments: DiffSegment[] = []
  const sanitizedSegments: DiffSegment[] = []
  const sanitizedRows: string[][] = []

  let maxCols = 0

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]
    maxCols = Math.max(maxCols, row.length)
    const cleanRow: string[] = []

    for (let c = 0; c < row.length; c++) {
      const cell = row[c]
      const needsQuotes = /[",\r\n]/.test(cell)
      if (needsQuotes) {
        originalSegments.push({ type: 'text', text: '"' })
        sanitizedSegments.push({ type: 'text', text: '"' })
      }

      const cellResult = sanitizeText(
        cell,
        { ...options, isCsv: true },
        sharedRegistry
      )

      cleanRow.push(cellResult.sanitizedText)

      for (const cat of ALL_CATEGORIES) {
        countsByCategory[cat] += cellResult.countsByCategory[cat]
      }
      for (const ent of cellResult.entities) {
        ent.id = `pii-${allEntities.length + 1}`
        allEntities.push(ent)
      }
      allLuhnRejected.push(...cellResult.luhnRejected)
      originalSegments.push(...cellResult.originalSegments)
      sanitizedSegments.push(...cellResult.sanitizedSegments)

      if (needsQuotes) {
        originalSegments.push({ type: 'text', text: '"' })
        sanitizedSegments.push({ type: 'text', text: '"' })
      }
      if (c < row.length - 1) {
        originalSegments.push({ type: 'text', text: ',' })
        sanitizedSegments.push({ type: 'text', text: ',' })
      }
    }

    sanitizedRows.push(cleanRow)
    if (r < rows.length - 1) {
      originalSegments.push({ type: 'text', text: '\n' })
      sanitizedSegments.push({ type: 'text', text: '\n' })
    }
  }

  const totalEntities = ALL_CATEGORIES.reduce(
    (sum, cat) => sum + countsByCategory[cat],
    0
  )

  return {
    originalText: csvText,
    sanitizedText: serializeCsv(sanitizedRows, { escapeFormulas: true }),
    entities: allEntities,
    luhnRejected: allLuhnRejected,
    countsByCategory,
    totalEntities,
    pseudonyms: sharedRegistry.getMappings(),
    originalSegments,
    sanitizedSegments,
    processingMs: Number((performance.now() - startTime).toFixed(2)),
    isCsv: true,
    csvRowCount: rows.length,
    csvColCount: maxCols,
  }
}
