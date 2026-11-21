// spec/phases/phase-06.md, design addition 1 (A-165): check.results, the stored check of each
// variant that has one. Both actors may read it.
import type { z } from 'zod'
import { projectScoped } from '@/shared/schemas/commands/project-scoped'
import { CHECK_TARGETS, ONE_CHECK_TARGET, oneCheckTarget } from '@/shared/schemas/commands/check'
import type { CheckResult } from '@/shared/schemas/checks'
import type { VariantCheckRow } from '@/shared/schemas/rows/variant-check'

export const checkResultsInput = projectScoped
  .extend(CHECK_TARGETS)
  .strict()
  .refine(oneCheckTarget, ONE_CHECK_TARGET)
export type CheckResultsInput = z.infer<typeof checkResultsInput>

export type VariantCheckState = {
  variantId: string
  rev: number // the variant's rev now
  checkedRev: number
  stale: boolean // checkedRev < rev
  ranAt: string
  ranBy: VariantCheckRow['ranBy']
  results: CheckResult[]
}

// Only variants with a check row.
export type CheckResultsReply = { variants: VariantCheckState[] }
