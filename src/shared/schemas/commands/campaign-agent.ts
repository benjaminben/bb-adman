import { z } from 'zod'
import { campaignCreateToolInput } from './campaign'
import { MAX_CAMPAIGN_LANGUAGES } from '@/shared/config/campaign-limits'
import { LANGUAGE_TAG } from '@/shared/export/output-paths'

// A-246 (spec/phases/phase-10.md, "Design additions"): the create_campaign tool's input. The
// same fields as campaignCreateToolInput (no placeSubjectPhoto, A-122), with sizes and
// languages optional: the tool fills what is left out (fillCreateDefaults) and
// campaign.create then checks the whole input with every one of its rules.
// Review leftovers, "Agent tools": an agent's language also has the form export's adPath
// takes (letters, digits and '-'). campaign.create itself does not check the form, so a tag
// like "fa_IR" from the window still reaches the right-to-left rule.
const shape = campaignCreateToolInput.shape

export const campaignCreateAgentInput = z.object({
  ...shape,
  sizes: shape.sizes.optional(),
  languages: z
    .array(shape.languages.element.regex(LANGUAGE_TAG))
    .min(1)
    .max(MAX_CAMPAIGN_LANGUAGES)
    .optional(),
})
export type CampaignCreateAgentInput = z.infer<typeof campaignCreateAgentInput>
