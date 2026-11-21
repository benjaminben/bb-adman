// translation.restore (spec/phases/phase-06.md, design additions 1 and 2; A-160). System
// command, deny and internal: the inverse of translation.set and translation.approve, and its
// own. Writes exactly the given values (synced_revs.copy from syncedCopyRev) and bumps
// variant.rev of each variant touched. Its inverse holds the values read before the write,
// on the list its input's scope names.
import { defineCommand } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import type { UndoScope } from '@/main/history/undo-lists'
import { placeLayer } from '@/main/translation/layers'
import {
  sameText,
  textValuesOf,
  writeTexts,
  type TextValues,
  type TextWrite,
} from '@/main/translation/write-text'
import {
  translationRestoreInput,
  type TranslationLayersReply,
  type TranslationRestoreInput,
} from '@/shared/schemas/commands/translation'
import { AppError } from '@/shared/schemas/result'

export type RestoreScope = TranslationRestoreInput['scope']

// The inverse on `list`, the undo list that `scope` names.
export function restoreInverse(
  projectId: string,
  items: TextValues[],
  scope: RestoreScope,
  list: UndoScope,
) {
  return { scope: list, call: { name: 'translation.restore', input: { projectId, scope, items } } }
}

export function translationRestore(deps: CoreDeps) {
  return defineCommand({
    name: 'translation.restore',
    internal: true,
    input: translationRestoreInput,
    projectId: (input) => input.projectId,
    run(ctx, input) {
      const db = ctx.project.db
      const ids = input.items.map((i) => i.layerId)
      if (new Set(ids).size !== ids.length) {
        throw new AppError('INVALID_INPUT', 'A layer is named twice.')
      }
      const placed = input.items.map((next) => ({ next, ...placeLayer(db, next.layerId) }))
      const writes: TextWrite[] = placed
        .map(({ next, layer }) => ({ row: layer, next }))
        .filter(({ row, next }) => !sameText(textValuesOf(row), next))
      const data: TranslationLayersReply = { layerIds: writes.map((w) => w.row.id) }
      // The list's ID comes from the first item's rows: set and approve put the named layer
      // first, whether or not it needs a write now.
      const first = placed[0]
      if (!first || writes.length === 0) return { data }
      writeTexts(ctx, writes, deps.now().toISOString())
      const list =
        input.scope === 'campaign'
          ? `campaign:${first.direction.campaignId}`
          : `variant:${first.variant.id}`
      const items = writes.map((w) => textValuesOf(w.row))
      const log = { campaignId: first.direction.campaignId }
      return { data, log, inverse: restoreInverse(input.projectId, items, input.scope, list) }
    },
  })
}
