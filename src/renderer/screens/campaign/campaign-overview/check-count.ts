// R2C-1 (spec/phases/round-2-campaign.md, design addition 1, R-8): the Checks tab's badge
// number. Over every variant whose stored check is current, the check results that warned.
// Checks have no error level, so this is warnings only (A-302). Pure.
import type { VariantCheckState } from '@/shared/schemas/queries/check'

export function warningCount(states: VariantCheckState[]): number {
  return states
    .filter((state) => !state.stale)
    .reduce((sum, state) => sum + state.results.filter((r) => r.status === 'warn').length, 0)
}
