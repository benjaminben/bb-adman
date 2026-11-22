// clip.remove (spec/phases/phase-07.md, "Clips and the track"): one clip off the track; its
// inverse is clip.restore with the whole row. first_clip_made stays as it is, so an emptied
// track stays empty (OI-20). Undo V. Agent deny.
import { defineCommand } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { deleteClip, readClip } from '@/main/clips/write-clip'
import { clipRemoveInput, type ClipReply } from '@/shared/schemas/commands/clip'
import { AppError } from '@/shared/schemas/result'

export const clipNotFound = () => new AppError('NOT_FOUND', 'That clip was not found.')

export function clipRemove(deps: CoreDeps) {
  return defineCommand({
    name: 'clip.remove',
    input: clipRemoveInput,
    projectId: (input) => input.projectId,
    run(ctx, input) {
      const row = readClip(ctx.project.db, input.clipId)
      if (!row) throw clipNotFound()
      deleteClip(ctx, row, deps.now().toISOString())
      const reply: ClipReply = { clipId: row.id }
      const call = { name: 'clip.restore', input: { projectId: input.projectId, rows: [row] } }
      return {
        data: reply,
        log: { variantId: row.variantId },
        inverse: { scope: `variant:${row.variantId}`, call },
      }
    },
  })
}
