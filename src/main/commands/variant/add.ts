// variant.add (spec/links-and-sync.md, "Fan-out"): makes one variant from the master with
// planVariant. Agent policy allow. fit is scale when left out, never fill (A-143). The inverse
// is variant.remove, on the campaign's list.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import {
  factsOf,
  hasVariantAt,
  readFanOutSource,
  refuseLanguage,
  sizeOf,
  writeVariant,
} from '@/main/links/fan-out-write'
import { planVariant } from '@/shared/links/fan-out-plan'
import { variantAddInput, type VariantReply } from '@/shared/schemas/commands/variant'
import { AppError } from '@/shared/schemas/result'

export function variantAdd(deps: CoreDeps) {
  return defineCommand({
    name: 'variant.add',
    input: variantAddInput,
    projectId: (input) => input.projectId,
    run(ctx, input): HandlerResult<VariantReply> {
      const db = ctx.project.db
      const source = readFanOutSource(db, input.directionId)
      const size = sizeOf(source, input.sizeLabel)
      refuseLanguage(source, input.language)
      if (hasVariantAt(db, input.directionId, size.label, input.language)) {
        throw new AppError(
          'RULE_VIOLATION',
          'This direction already has a variant at this size, language and format.',
          { reason: 'variant_exists' },
        )
      }
      const { master } = source
      const layers = planVariant({
        master: factsOf(master, master.language),
        masterLayers: source.masterLayers,
        target: factsOf(size, input.language),
        fit: input.fit ?? 'scale',
        pictureSize: source.pictureSize,
      })
      const now = deps.now().toISOString()
      const variantId = writeVariant(ctx, source, { size, language: input.language, layers }, now)
      const campaignId = source.campaign.id
      const call = {
        name: 'variant.remove',
        input: { projectId: input.projectId, variantIds: [variantId] },
      }
      return {
        data: { variantId },
        log: { campaignId, variantId },
        inverse: { scope: `campaign:${campaignId}`, call },
      }
    },
  })
}
