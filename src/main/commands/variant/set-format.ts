// variant.setFormat (spec/data-rules.md, "Changing a variant's format"): image to video and
// back, with the grid test in both directions. Only the format column is written, apart from
// variant.rev going up by one; no layer, clip or video setting is touched. Image to video makes
// the first clip once (OI-20, A-180). Undo V: the inverse puts the format back and, when this
// change made the first clip, removes it (undoClipId). Agent allow [D-025].
import { defineCommand, type HandlerResult, type ProjectContext } from '@/main/commands/types'
import { bumpVariantRev } from '@/main/commands/variant-rev'
import type { CoreDeps } from '@/main/core-deps'
import { addFirstClip, clipsOf, deleteClip, readClip, readVariant } from '@/main/clips/write-clip'
import { variantSetFormatInput, type VariantReply } from '@/shared/schemas/commands/variant'
import { AppError } from '@/shared/schemas/result'
import { gridTest } from './grid-test'

const notOwnClip = () => new AppError('INVALID_INPUT', 'That clip is not on this post.')

// The undo of an image-to-video change that made the first clip: the clip goes, and
// first_clip_made goes back to 0 unless another clip landed on the track meanwhile. True when
// a clip was removed (deleteClip bumped variant.rev).
function removeFirstClip(ctx: ProjectContext, variantId: string, clipId: string, now: string) {
  const db = ctx.project.db
  const clip = readClip(db, clipId)
  if (!clip) return false
  if (clip.variantId !== variantId) throw notOwnClip()
  deleteClip(ctx, clip, now)
  if (clipsOf(db, variantId).length === 0) {
    db.prepare('UPDATE variant SET first_clip_made = 0 WHERE id = ?').run(variantId)
  }
  return true
}

export function variantSetFormat(deps: CoreDeps) {
  return defineCommand({
    name: 'variant.setFormat',
    input: variantSetFormatInput,
    projectId: (input) => input.projectId,
    run(ctx, input): HandlerResult<VariantReply> {
      const { variantId, format, undoClipId } = input
      if (undoClipId !== undefined && ctx.actor === 'agent') {
        throw new AppError('INVALID_INPUT', 'Only an undo removes a clip this way.')
      }
      const db = ctx.project.db
      const variant = readVariant(db, variantId)
      if (!variant) throw new AppError('NOT_FOUND', 'That variant was not found.')
      const result = { data: { variantId }, log: { variantId } }
      if (variant.format === format) return result
      gridTest(db, variant, format)
      const now = deps.now().toISOString()
      db.prepare('UPDATE variant SET format = ? WHERE id = ?').run(format, variantId)
      const madeClipId = format === 'video' ? addFirstClip(ctx, variantId, now) : null
      const removed = undoClipId ? removeFirstClip(ctx, variantId, undoClipId, now) : false
      // A clip written or removed has bumped rev once already.
      if (!madeClipId && !removed) bumpVariantRev(ctx, variantId, now)
      const back = { projectId: input.projectId, variantId, format: variant.format }
      const call = {
        name: 'variant.setFormat',
        input: madeClipId ? { ...back, undoClipId: madeClipId } : back,
      }
      return { ...result, inverse: { scope: `variant:${variantId}`, call } }
    },
  })
}
