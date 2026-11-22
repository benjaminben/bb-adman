// The Checks tab's words (spec/phases/design-wave-screens-b.md, "CAMP-4"): the six checks in
// column order with their full names and short heads, a cell's tip "{name}: {state}", a row's
// label "{size} · {language}" and the not-checked count. Pure.
import type { CheckId, CheckResult, CheckStatus } from '@/shared/schemas/checks'
import type { VariantCheckState } from '@/shared/schemas/queries/check'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'

export const CHECKS: CheckId[] = [
  'required-assets',
  'text-colours',
  'prohibited-words',
  'required-words',
  'unapproved-translations',
  'text-overflow',
]

const NAMES: Record<CheckId, string> = {
  'required-assets': 'Required files',
  'text-colours': 'Text colours',
  'prohibited-words': 'Prohibited words',
  'required-words': 'Required words',
  'unapproved-translations': 'Translations approved',
  'text-overflow': 'Text fits',
}

const HEADS: Record<CheckId, string> = {
  'required-assets': 'Files',
  'text-colours': 'Colours',
  'prohibited-words': 'Prohibited',
  'required-words': 'Required',
  'unapproved-translations': 'Translated',
  'text-overflow': 'Fits',
}

// What each check looks for, one line each, for the InfoTip "About Checks".
export const ABOUT: Record<CheckId, string> = {
  'required-assets': 'Required files: each required file is on the post.',
  'text-colours': 'Text colours: every text uses a palette colour.',
  'prohibited-words': 'Prohibited words: no prohibited word is used.',
  'required-words': 'Required words: every required word is used.',
  'unapproved-translations': 'Translations approved: every translated text is approved.',
  'text-overflow': 'Text fits: every text fits its box.',
}

const STATUS: Record<CheckStatus, string> = {
  pass: 'Passed',
  warn: 'Warning',
  skipped: 'Skipped',
}

export const checkName = (id: CheckId): string => NAMES[id]

export const checkHead = (id: CheckId): string => HEADS[id]

export const statusWord = (status: CheckStatus): string => STATUS[status]

// A cell's name and tooltip; a skipped check adds its reason.
export function cellTip(r: CheckResult): string {
  const tip = `${checkName(r.checkId)}: ${statusWord(r.status).toLowerCase()}`
  const reason = r.status === 'skipped' ? r.findings[0]?.message : undefined
  return reason === undefined ? tip : `${tip}. ${reason}`
}

export const rowLabel = (v: VariantSummary): string => `${v.sizeLabel} · ${v.language}`

// The posts whose stored check is out of date, for the "{n} not checked" mark. The warning
// count is campaign-overview/check-count.ts's, the same as the tab's badge.
export function staleCount(states: VariantCheckState[]): number {
  return states.filter((s) => s.stale).length
}

// The results with something to read under an open row, in column order.
export function withFindings(results: CheckResult[]): CheckResult[] {
  return CHECKS.flatMap((id) => results.filter((r) => r.checkId === id)).filter(
    (r) => r.status !== 'pass' && r.findings.length > 0,
  )
}
