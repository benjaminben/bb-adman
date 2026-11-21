// variant.remove (spec/links-and-sync.md, "Adding back and removing variants"): system
// command, the inverse of fan-out, variant.add and variant.restore. Agent policy deny. The
// refusals of variant.delete, checked for every ID before any write. The inverse is
// variant.restore with every removed variant, on the campaign's list; each variant's own list
// is cleared (A-141).
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { deleteVariants, readSnapshot } from '@/main/links/snapshot'
import type { VariantSnapshot } from '@/shared/schemas/links'
import { variantRemoveInput, type VariantsReply } from '@/shared/schemas/commands/variant'
import { AppError } from '@/shared/schemas/result'
import { removableCampaign } from './delete'

export const ONE_CAMPAIGN = 'These variants are not all in one campaign.'

export function variantRemove(_deps: CoreDeps) {
  return defineCommand({
    name: 'variant.remove',
    internal: true,
    input: variantRemoveInput,
    projectId: (input) => input.projectId,
    run(ctx, input): HandlerResult<VariantsReply> {
      const db = ctx.project.db
      const ids = [...new Set(input.variantIds)]
      const campaigns = new Set(ids.map((id) => removableCampaign(db, id)))
      const [campaignId] = campaigns
      if (campaigns.size !== 1 || !campaignId) throw new AppError('INVALID_INPUT', ONE_CAMPAIGN)
      const snapshots = ids.flatMap((id): VariantSnapshot[] => {
        const snapshot = readSnapshot(db, id)
        return snapshot ? [snapshot] : []
      })
      const variantIds = snapshots.map((s) => s.variant.id)
      deleteVariants(ctx, variantIds)
      const call = { name: 'variant.restore', input: { projectId: input.projectId, snapshots } }
      return {
        data: { variantIds },
        log: { campaignId },
        inverse: { scope: `campaign:${campaignId}`, call },
        clearScopes: variantIds.map((id) => `variant:${id}`),
      }
    },
  })
}
