// The translation panel's words and lists (spec/phases/phase-06.md, design addition 8), worked
// out from translation.forCampaign's rows alone. Pure. Every text here is drawn as React text.
import { languageName } from '@/renderer/ui/language-name'
import type { TranslationForCampaign, TranslationRow } from '@/shared/schemas/queries/translation'

export { languageName }

export type LanguageGroup = { language: string; rows: TranslationRow[] }
export type ApproveLayer = { layerId: string; copyRev: number }

const MARKS = { missing: 'Missing', proposed: 'Proposed', approved: 'Approved' } as const
const SOURCES = {
  ai: 'from AI',
  agent: 'from an agent',
  user: 'from you',
  brief: 'from the brief',
} as const

export function markWords(
  status: TranslationRow['status'],
  source: TranslationRow['source'],
): { mark: string; from: string | null } {
  return { mark: MARKS[status ?? 'missing'], from: source === null ? null : SOURCES[source] }
}

export function sourceLine(sourceText: string | null): string {
  return sourceText ?? 'No source text'
}

export function rowLine(row: TranslationRow): string {
  return `${row.title} · ${row.sizeLabel} · ${row.layerName}`
}

// The label over a row's source text: "English (source)" (R2C-4).
export function sourceLabel(name: string): string {
  return `${name} (source)`
}

export function groupHeading(language: string, rows: TranslationRow[]): string {
  const approved = rows.filter((row) => row.status === 'approved').length
  return `${languageName(language)} · ${approved} of ${rows.length} approved`
}

// One group per language other than the primary one, in the order the rows come.
export function groupRows(data: TranslationForCampaign): LanguageGroup[] {
  const groups = new Map<string, TranslationRow[]>()
  for (const row of data.rows) {
    if (row.language === data.primaryLanguage) continue
    const list = groups.get(row.language) ?? []
    list.push(row)
    groups.set(row.language, list)
  }
  return [...groups].map(([language, rows]) => ({ language, rows }))
}

// The proposed rows, each with the copy counter the query gave it (P6-4b).
export function approvalOf(rows: TranslationRow[]): ApproveLayer[] {
  return rows
    .filter((row) => row.status === 'proposed')
    .map((row) => ({ layerId: row.layerId, copyRev: row.copyRev }))
}

// P6-18: a translation job is one per direction and language, so each pair the rows span is one
// paid request. Variants of the same pair share their job.
export function requestCount(rows: Pick<TranslationRow, 'directionId' | 'language'>[]): number {
  return new Set(rows.map((row) => `${row.directionId}\u0000${row.language}`)).size
}
