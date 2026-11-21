// translation.set (spec/phases/phase-06.md, design addition 2; A-160, A-162). Writes a
// translation, proposed from the user or the agent, never approved, whoever sends it
// [REQ: FR-200]. With applyToSameLanguage, also the same-key text layers of the direction's
// other variants in that language, unless their overrides hold copy. Undo on the named layer's
// variant list: one translation.restore with every written layer's previous values.
import { defineCommand } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import {
  masterLayerByKey,
  placeLayer,
  requireTranslation,
  sameLanguageTwins,
} from '@/main/translation/layers'
import { sameText, textValuesOf, writeTexts, type TextWrite } from '@/main/translation/write-text'
import {
  translationSetInput,
  type TranslationLayersReply,
} from '@/shared/schemas/commands/translation'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { restoreInverse } from './restore'

export function translationSet(deps: CoreDeps) {
  return defineCommand({
    name: 'translation.set',
    input: translationSetInput,
    projectId: (input) => input.projectId,
    run(ctx, input) {
      const db = ctx.project.db
      const placed = placeLayer(db, input.layerId)
      requireTranslation(placed)
      const rows = [
        placed.layer,
        ...(input.applyToSameLanguage ? sameLanguageTwins(db, placed) : []),
      ]
      const master = masterLayerByKey(db, placed.direction.id, placed.layer.key)
      const next = (row: LayerRow) => ({
        layerId: row.id,
        copy: input.text,
        translationStatus: 'proposed' as const,
        translationSource: ctx.actor,
        syncedCopyRev: row.linked && master ? master.revs.copy : row.syncedRevs.copy,
      })
      const writes: TextWrite[] = rows
        .map((row) => ({ row, next: next(row) }))
        .filter(({ row, next }) => !sameText(textValuesOf(row), next))
      const data: TranslationLayersReply = { layerIds: writes.map((w) => w.row.id) }
      const log = { variantId: placed.variant.id }
      if (writes.length === 0) return { data, log }
      writeTexts(ctx, writes, deps.now().toISOString())
      const items = writes.map((w) => textValuesOf(w.row))
      const scope = `variant:${placed.variant.id}`
      return { data, log, inverse: restoreInverse(input.projectId, items, scope) }
    },
  })
}
