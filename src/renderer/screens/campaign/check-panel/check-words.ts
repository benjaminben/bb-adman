// The check panel's words (spec/phases/phase-06.md, design addition 8): the six check names,
// the status words, a block's heading and the summary line. Pure.
import type { CheckId, CheckStatus } from '@/shared/schemas/checks'
import type { VariantCheckState } from '@/shared/schemas/queries/check'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'

const NAMES: Record<CheckId, string> = {
  'required-assets': 'Required files',
  'text-colours': 'Text colours',
  'prohibited-words': 'Prohibited words',
  'required-words': 'Required words',
  'unapproved-translations': 'Translations approved',
  'text-overflow': 'Text fits',
}

const STATUS: Record<CheckStatus, string> = {
  pass: 'Passed',
  warn: 'Warning',
  skipped: 'Skipped',
}

export const checkName = (id: CheckId): string => NAMES[id]

export const statusWord = (status: CheckStatus): string => STATUS[status]

export function blockHeading(v: VariantSummary): string {
  return `${v.title} · ${v.width}×${v.height} · ${v.language}`
}

// A warning counts only on a check that is still current, as the tile's "Check warning" badge
// does (src/main/checks/badges.ts); a stale check counts under "not checked since a change".
export function hasBrandWarning(s: VariantCheckState): boolean {
  return !s.stale && s.results.some((r) => r.group === 'brand-legal' && r.status === 'warn')
}

export function summaryLine(states: VariantCheckState[]): string {
  const n = states.length
  const w = states.filter(hasBrandWarning).length
  const s = states.filter((state) => state.stale).length
  const posts = n === 1 ? 'post' : 'posts'
  return `${n} ${posts} checked · ${w} with brand or legal warnings · ${s} not checked since a change`
}
