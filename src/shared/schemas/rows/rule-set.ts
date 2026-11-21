import { z } from 'zod'
import { RuleSetValues } from '@/shared/schemas/commands/campaign'

// SPEC 3.3 rule_set, in wire form (SPEC 4.4).
export const RuleSetRow = RuleSetValues.extend({ campaignId: z.string() })
export type RuleSetRow = z.infer<typeof RuleSetRow>
