// spec/phases/phase-06.md, design additions 1 and 5: check.run, by campaign or by variants.
import { z } from 'zod'
import { projectScoped } from './project-scoped'
import type { CheckResult } from '@/shared/schemas/checks'

const id = z.string().min(1)

// Either a campaign or a list of variants, not both. Shared with check.results.
export const CHECK_TARGETS = {
  campaignId: id.optional(),
  variantIds: z.array(id).min(1).max(1000).optional(),
}
export const oneCheckTarget = (i: { campaignId?: string; variantIds?: string[] }) =>
  (i.campaignId === undefined) !== (i.variantIds === undefined)
export const ONE_CHECK_TARGET = { message: 'Name a campaign or posts.', path: ['campaignId'] }

export const checkRunInput = projectScoped
  .extend(CHECK_TARGETS)
  .strict()
  .refine(oneCheckTarget, ONE_CHECK_TARGET)
export type CheckRunInput = z.infer<typeof checkRunInput>

export type CheckRunReply = {
  variants: Array<{ variantId: string; checkedRev: number; results: CheckResult[] }>
}
