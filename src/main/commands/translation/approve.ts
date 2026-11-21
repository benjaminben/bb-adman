// translation.approve (spec/phases/phase-06.md, design addition 2; A-159). Agent policy deny.
// Every layer must be a text layer of a variant not in the primary language, with a text to
// approve: one with status missing (or none yet) refuses the whole command. Sets approved on
// each proposed one; approved ones are left. No layer counter changes; variant.rev goes up
// once per variant changed, so the last check becomes stale. Undo on the campaign list.
import { defineCommand } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { placeLayer, requireTranslation } from '@/main/translation/layers'
import { textValuesOf, writeTexts, type TextWrite } from '@/main/translation/write-text'
import {
  translationApproveInput,
  type TranslationLayersReply,
} from '@/shared/schemas/commands/translation'
import { AppError } from '@/shared/schemas/result'
import { restoreInverse } from './restore'

export function translationApprove(deps: CoreDeps) {
  return defineCommand({
    name: 'translation.approve',
    input: translationApproveInput,
    projectId: (input) => input.projectId,
    run(ctx, input) {
      const db = ctx.project.db
      const placed = [...new Set(input.layerIds)].map((id) => placeLayer(db, id))
      placed.forEach(requireTranslation)
      const campaignIds = new Set(placed.map((p) => p.direction.campaignId))
      if (campaignIds.size > 1) {
        throw new AppError('INVALID_INPUT', 'These texts are in more than one campaign.')
      }
      const missing = placed
        .filter((p) => p.layer.translationStatus === 'missing' || !p.layer.translationStatus)
        .map((p) => p.layer.id)
      if (missing.length > 0) {
        throw new AppError('RULE_VIOLATION', 'Some of these have no translation yet.', {
          reason: 'translation_missing',
          layerIds: missing,
        })
      }
      const writes: TextWrite[] = placed
        .filter((p) => p.layer.translationStatus === 'proposed')
        .map(({ layer }) => ({
          row: layer,
          next: { ...textValuesOf(layer), translationStatus: 'approved' },
        }))
      const data: TranslationLayersReply = { layerIds: writes.map((w) => w.row.id) }
      const campaignId = placed[0]?.direction.campaignId
      const log = campaignId ? { campaignId } : undefined
      if (writes.length === 0 || !campaignId) return { data, log }
      writeTexts(ctx, writes, deps.now().toISOString())
      const items = writes.map((w) => textValuesOf(w.row))
      const scope = `campaign:${campaignId}`
      return { data, log, inverse: restoreInverse(input.projectId, items, scope) }
    },
  })
}
