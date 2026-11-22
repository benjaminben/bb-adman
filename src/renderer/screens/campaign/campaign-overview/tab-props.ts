// The props every campaign view tab's panel takes (spec/phases/round-2-campaign.md, design
// addition 1): the campaign and its campaign.get reply.
import type { CampaignGet } from '@/shared/schemas/queries/campaign'

export type CampaignTabProps = { projectId: string; campaignId: string; data: CampaignGet }
