// spec/phases/phase-06.md, design addition 5, "Badges": the two check marks of a variant from
// its variant_check row (null when it was never checked) and its rev now.
import type { VariantBadges } from '@/shared/schemas/queries/campaign'
import type { VariantCheckRow } from '@/shared/schemas/rows/variant-check'

export type CheckBadges = Pick<VariantBadges, 'checkWarning' | 'checkStale'>

// checkWarning: a fresh row with a brand-legal warn. checkStale: a row older than the variant.
export function checkBadges(row: VariantCheckRow | null, rev: number): CheckBadges {
  if (!row) return { checkWarning: false, checkStale: false }
  const fresh = row.checkedRev === rev
  const brandWarn = row.results.some((r) => r.group === 'brand-legal' && r.status === 'warn')
  return { checkWarning: fresh && brandWarn, checkStale: row.checkedRev < rev }
}
