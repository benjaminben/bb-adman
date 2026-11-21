// spec/phases/phase-06.md, design addition 5, "Badges": the two check marks of a variant from
// its variant_check row (null when it was never checked) and its rev now. Stub (P6-1): marks
// nothing until P6-3 replaces the body.
import type { VariantBadges } from '@/shared/schemas/queries/campaign'
import type { VariantCheckRow } from '@/shared/schemas/rows/variant-check'

export type CheckBadges = Pick<VariantBadges, 'checkWarning' | 'checkStale'>

export function checkBadges(_row: VariantCheckRow | null, _rev: number): CheckBadges {
  return { checkWarning: false, checkStale: false }
}
