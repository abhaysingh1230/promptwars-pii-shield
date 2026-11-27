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

/**
 * Parses RFC-4180 CSV content into rows of cells in O(n) single pass.
 */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentCell = ''
  let inQuotes = false

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    const next = input[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentCell += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        currentCell += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      currentRow.push(currentCell)
      currentCell = ''
    } else if (ch === '\r' && next === '\n') {
      currentRow.push(currentCell)
      rows.push(currentRow)
      currentRow = []
      currentCell = ''
      i++
    } else if (ch === '\n' || ch === '\r') {
      currentRow.push(currentCell)
      rows.push(currentRow)
      currentRow = []
      currentCell = ''
    } else {
      currentCell += ch
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell)
    rows.push(currentRow)
  }

  return rows
}

/**
 * Escapes and formats a cell value according to RFC-4180 CSV quoting rules.
 */
export function formatCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function serializeCsv(rows: string[][]): string {
  return rows.map((row) => row.map(formatCsvCell).join(',')).join('\n')
}

/**
 * Sanitizes CSV cell-by-cell while preserving row/column boundaries and
 * maintaining consistent pseudonym mappings across the entire table.
 */
export function sanitizeCsvDocument(
  csvText: string,
  options: SanitizeOptions
): SanitizeResult {
  const startTime = performance.now()
  const rows = parseCsv(csvText)
  const sharedRegistry = new PseudonymRegistry()

  const countsByCategory: Record<PiiCategory, number> = {
    credit_card: 0,
    pan: 0,
    aadhaar: 0,
    email: 0,
    phone: 0,
    ip_address: 0,
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
    sanitizedText: serializeCsv(sanitizedRows),
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
