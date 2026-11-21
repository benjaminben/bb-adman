import { z } from 'zod'
import { projectScoped } from './project-scoped'

// SPEC 4.2 campaign.update and campaign.delete. Beside the frozen campaign.ts (SPEC 14
// step 0: slice C adds its other campaign schemas beside that file).

const filled = z.string().trim().min(1)
const optionalText = z.string().nullable().optional()

// languages and sizes are not taken yet: what changing them does to the primary language and
// the master variant waits for a ruling (slice C report). An unknown key is refused, so a
// caller is never told a change was made when it was not.
export const campaignUpdateInput = projectScoped
  .extend({
    campaignId: z.string().min(1),
    name: filled.optional(),
    audience: filled.optional(),
    tone: optionalText,
    offer: optionalText,
    callToAction: optionalText,
  })
  .strict()
export type CampaignUpdateInput = z.infer<typeof campaignUpdateInput>

export const campaignDeleteInput = projectScoped.extend({ campaignId: z.string().min(1) })
export type CampaignDeleteInput = z.infer<typeof campaignDeleteInput>

// The campaign.create reply (SPEC 14 1.42 C4-2).
export type CampaignCreated = { campaignId: string; directionId: string; variantId: string }
