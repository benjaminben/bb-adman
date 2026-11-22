// The create_campaign reply picker (spec/phases/phase-10.md, A-246; spec/mcp-and-agents.md,
// rules for every tool). It names the three IDs campaign.create gives and nothing else, so a
// field added to the command's reply later cannot reach an agent without a change here.
import type { CampaignCreated } from '@/shared/schemas/commands/campaign-edit'
import type { ReplyPicker } from './read-replies'

export const createdFields: ReplyPicker = (data) => {
  const made = data as CampaignCreated
  return { campaignId: made.campaignId, directionId: made.directionId, variantId: made.variantId }
}
