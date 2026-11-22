import { z } from 'zod'
import { campaignCreateToolInput } from './campaign'

// A-246 (spec/phases/phase-10.md, "Design additions"): the create_campaign tool's input. The
// same fields as campaignCreateToolInput (no placeSubjectPhoto, A-122), with sizes and
// languages optional: the tool fills what is left out (fillCreateDefaults) and
// campaign.create then checks the whole input with every one of its rules.
const shape = campaignCreateToolInput.shape

export const campaignCreateAgentInput = z.object({
  ...shape,
  sizes: shape.sizes.optional(),
  languages: shape.languages.optional(),
})
export type CampaignCreateAgentInput = z.infer<typeof campaignCreateAgentInput>
