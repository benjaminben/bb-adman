// The reply picker of create_campaign_from_brief (spec/phases/round-2-platform.md, D6): the
// campaign, direction, master variant and subject IDs, and for the files command the imported
// asset IDs in brief order. Named field by field, so nothing else the command returns (a path,
// a picture note, the brief) can leave through MCP without a change here.
import type { BriefCreated } from '@/main/commands/campaign/from-brief'
import type { ReplyPicker } from './read-replies'

const ids = (list: readonly unknown[]): string[] => list.map((id) => String(id))

export const briefCreatedFields: ReplyPicker = (data) => {
  const made = data as BriefCreated
  return {
    campaignId: made.campaignId,
    directionId: made.directionId,
    variantId: made.variantId,
    subjectIds: ids(made.subjectIds),
    ...(made.assetIds ? { assetIds: ids(made.assetIds) } : {}),
  }
}
