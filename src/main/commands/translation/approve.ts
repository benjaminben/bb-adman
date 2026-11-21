// translation.approve (spec/phases/phase-06.md, design addition 2; A-159). Agent policy deny.
// Every layer must be a text layer of a variant not in the primary language, with a text to
// approve: one with status missing (or none yet) refuses the whole command. Sets approved on
// each proposed one; approved ones are left. No layer counter changes; variant.rev goes up
// once per variant changed, so the last check becomes stale. Undo on the campaign list.
// Each layer comes with the copy counter the user read; any other stored counter refuses all
// (translation_changed), so a text rewritten since the read is never approved unseen.
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
      const ids = input.layers.map((l) => l.layerId)
      if (new Set(ids).size !== ids.length) {
        throw new AppError('INVALID_INPUT', 'A layer is named twice.')
      }
      const placed = ids.map((id) => placeLayer(db, id))
      placed.forEach(requireTranslation)
      const campaignIds = new Set(placed.map((p) => p.direction.campaignId))
      if (campaignIds.size > 1) {
        throw new AppError('INVALID_INPUT', 'These texts are in more than one campaign.')
      }
      const changed = placed
        .filter((p, i) => p.layer.revs.copy !== input.layers[i]?.copyRev)
        .map((p) => p.layer.id)
      if (changed.length > 0) {
        throw new AppError(
          'RULE_VIOLATION',
          'A text changed after you read it. Read it again, then approve.',
          { reason: 'translation_changed', layerIds: changed },
        )
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
      const list = `campaign:${campaignId}`
      return { data, log, inverse: restoreInverse(input.projectId, items, 'campaign', list) }
    },
  })
}
