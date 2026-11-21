import { projectScoped } from './project-scoped'
import { RuleSetValues } from './campaign'
import { z } from 'zod'

// SPEC 4.2 ruleSet.update (any of the four lists) and ruleSet.copyFrom.
export const ruleSetUpdateInput = projectScoped
  .extend({ campaignId: z.string().min(1) })
  .extend(RuleSetValues.partial().shape)
export type RuleSetUpdateInput = z.infer<typeof ruleSetUpdateInput>

export const ruleSetCopyFromInput = projectScoped.extend({
  campaignId: z.string().min(1),
  sourceCampaignId: z.string().min(1),
})
export type RuleSetCopyFromInput = z.infer<typeof ruleSetCopyFromInput>
