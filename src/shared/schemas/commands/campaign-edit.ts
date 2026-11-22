import { z } from 'zod'
import { CampaignSizes, campaignCreateInput } from './campaign'
import { projectScoped } from './project-scoped'

// SPEC 4.2 campaign.update and campaign.delete. Beside the frozen campaign.ts (SPEC 14
// step 0: slice C adds its other campaign schemas beside that file).

const filled = z.string().trim().min(1)
const optionalText = z.string().nullable().optional()

// [1.42] languages and sizes take the campaign.create schemas (the size labels are checked by
// the handler, LP-4). An unknown key is refused, so
// a caller is never told a change was made when it was not.
export const campaignUpdateInput = projectScoped
  .extend({
    campaignId: z.string().min(1),
    name: filled.optional(),
    audience: filled.optional(),
    tone: optionalText,
    offer: optionalText,
    callToAction: optionalText,
    languages: campaignCreateInput.shape.languages.optional(),
    sizes: CampaignSizes.optional(),
  })
  .strict()
export type CampaignUpdateInput = z.infer<typeof campaignUpdateInput>

export const campaignDeleteInput = projectScoped.extend({ campaignId: z.string().min(1) })
export type CampaignDeleteInput = z.infer<typeof campaignDeleteInput>

// The campaign.create reply (SPEC 14 1.42 C4-2).
export type CampaignCreated = { campaignId: string; directionId: string; variantId: string }
