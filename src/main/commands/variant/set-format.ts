// variant.setFormat (spec/data-rules.md, "Changing a variant's format"): image to video and
// back, with the grid test in both directions. Only the format column is written, apart from
// variant.rev going up by one; no layer, clip or video setting is touched. Image to video makes
// the first clip once (OI-20, A-180). Undo V: the inverse puts the format back and, when this
// change made the first clip, removes it (undoClipId); the inverse of that undo makes it again
// under the same ID (redoClipId), so a redone clip edit finds it. The two fields are taken
// only during an undo or redo, never from an agent (P7-10b). Agent allow [D-025].
import { defineCommand, type HandlerResult, type ProjectContext } from '@/main/commands/types'
import { bumpVariantRev } from '@/main/commands/variant-rev'
import type { CoreDeps } from '@/main/core-deps'
import { addFirstClip, clipsOf, deleteClip, readClip, readVariant } from '@/main/clips/write-clip'
import {
  variantSetFormatInput,
  type VariantReply,
  type VariantSetFormatInput,
} from '@/shared/schemas/commands/variant'
import { AppError } from '@/shared/schemas/result'
import { gridTest } from './grid-test'

const notOwnClip = () => new AppError('INVALID_INPUT', 'That clip is not on this post.')

// P7-10b: the undo-only fields come only from a replayed inverse, and never from an agent.
function checkUndoOnly(ctx: ProjectContext, input: VariantSetFormatInput): void {
  if (input.undoClipId === undefined && input.redoClipId === undefined) return
  if (ctx.actor === 'agent' || !ctx.replay) {
    throw new AppError('INVALID_INPUT', 'Only an undo or redo names a clip this way.')
  }
}

// The undo of an image-to-video change that made the first clip: the clip goes, and
// first_clip_made goes back to 0 unless another clip landed on the track meanwhile. The ID of
// the clip removed (deleteClip bumped variant.rev), or null.
function removeFirstClip(ctx: ProjectContext, variantId: string, clipId: string, now: string) {
  const db = ctx.project.db
  const clip = readClip(db, clipId)
  if (!clip) return null
  if (clip.variantId !== variantId) throw notOwnClip()
  deleteClip(ctx, clip, now)
  if (clipsOf(db, variantId).length === 0) {
    db.prepare('UPDATE variant SET first_clip_made = 0 WHERE id = ?').run(variantId)
  }
  return clip.id
}

export function variantSetFormat(deps: CoreDeps) {
  return defineCommand({
    name: 'variant.setFormat',
    input: variantSetFormatInput,
    projectId: (input) => input.projectId,
    run(ctx, input): HandlerResult<VariantReply> {
      checkUndoOnly(ctx, input)
      const { variantId, format, undoClipId, redoClipId } = input
      const db = ctx.project.db
      const variant = readVariant(db, variantId)
      if (!variant) throw new AppError('NOT_FOUND', 'That variant was not found.')
      const result = { data: { variantId }, log: { variantId } }
      if (variant.format === format) return result
      gridTest(db, variant, format)
      const now = deps.now().toISOString()
      db.prepare('UPDATE variant SET format = ? WHERE id = ?').run(format, variantId)
      const madeClipId = format === 'video' ? addFirstClip(ctx, variantId, now, redoClipId) : null
      const removedId = undoClipId ? removeFirstClip(ctx, variantId, undoClipId, now) : null
      // A clip written or removed has bumped rev once already.
      if (!madeClipId && !removedId) bumpVariantRev(ctx, variantId, now)
      const back = { projectId: input.projectId, variantId, format: variant.format }
      const clip = madeClipId
        ? { undoClipId: madeClipId }
        : removedId
          ? { redoClipId: removedId }
          : {}
      const call = { name: 'variant.setFormat', input: { ...back, ...clip } }
      return { ...result, inverse: { scope: `variant:${variantId}`, call } }
    },
  })
}
