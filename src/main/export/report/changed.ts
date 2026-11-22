// Changed since the previous export (spec/phases/phase-08.md "Report", FR-238, A-199): this
// ad's rev against the one the previous report stored. Pure.
import type { Report, ReportVariant } from '@/shared/schemas/report'

// null on a first export.
export function changedSince(
  previous: Report | null,
  variantId: string,
  rev: number,
): ReportVariant['changedSincePrevious'] {
  if (!previous) return null
  const before = previous.variants.find((v) => v.variantId === variantId)
  if (!before) return 'not_in_previous'
  return before.rev === rev ? 'unchanged' : 'changed'
}
