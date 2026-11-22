// clip.restore (spec/phases/phase-07.md, "Clips and the track"): the inverse of clip.remove.
// System command: deny and internal, so no window and no agent can send it.
// Stub (P7-1): refuses in prepare, before it reads or writes anything, until P7-9 fills it.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { clipRestoreInput, type ClipRestoreReply } from '@/shared/schemas/commands/clip'
import { videoRefusal } from '@/shared/video/messages'

export function clipRestore(_deps: CoreDeps) {
  return defineCommand({
    name: 'clip.restore',
    internal: true,
    input: clipRestoreInput,
    projectId: (input) => input.projectId,
    prepare(): Promise<undefined> {
      return Promise.reject(videoRefusal('video_not_built'))
    },
    run(): HandlerResult<ClipRestoreReply> {
      throw videoRefusal('video_not_built')
    },
  })
}
