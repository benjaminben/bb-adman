// translation.restore (spec/phases/phase-06.md, design additions 1 and 2; A-160). System
// command, deny and internal: the inverse of translation.set and translation.approve, and its
// own. Writes exactly the given values (synced_revs.copy from syncedCopyRev) and bumps
// variant.rev of each variant touched. Its inverse holds the values read before the write.
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
} from '@/shared/schemas/commands/translation'
import { AppError } from '@/shared/schemas/result'

export function restoreInverse(projectId: string, items: TextValues[], scope: UndoScope) {
  return { scope, call: { name: 'translation.restore', input: { projectId, items } } }
}

const REVIEW = new Set(['proposed', 'approved'])

// A change of status between proposed and approved only: an approval or its undo.
function isApproval({ row, next }: TextWrite): boolean {
  const was = textValuesOf(row)
  return (
    was.copy === next.copy &&
    was.translationSource === next.translationSource &&
    was.syncedCopyRev === next.syncedCopyRev &&
    REVIEW.has(was.translationStatus ?? '') &&
    REVIEW.has(next.translationStatus ?? '')
  )
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
      const first = placed.find((p) => p.layer.id === writes[0]?.row.id)
      if (!first) return { data }
      writeTexts(ctx, writes, deps.now().toISOString())
      // The list the caller used: approve's is the campaign's, set's the named layer's
      // variant, which set lists first (spec/phases/phase-06.md, design addition 1).
      const scope = writes.every(isApproval)
        ? `campaign:${first.direction.campaignId}`
        : `variant:${first.variant.id}`
      const items = writes.map((w) => textValuesOf(w.row))
      const log = { campaignId: first.direction.campaignId }
      return { data, log, inverse: restoreInverse(input.projectId, items, scope) }
    },
  })
}
