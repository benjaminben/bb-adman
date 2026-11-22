// clip.update (spec/phases/phase-07.md, "Clips and the track"): a clip's start, trim,
// placement or sound. Undo V. Agent deny.
// Stub (P7-1): refuses in prepare, before it reads or writes anything, until P7-9 fills it.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { clipUpdateInput, type ClipReply } from '@/shared/schemas/commands/clip'
import { videoRefusal } from '@/shared/video/messages'

export function clipUpdate(_deps: CoreDeps) {
  return defineCommand({
    name: 'clip.update',
    input: clipUpdateInput,
    projectId: (input) => input.projectId,
    prepare(): Promise<undefined> {
      return Promise.reject(videoRefusal('video_not_built'))
    },
    run(): HandlerResult<ClipReply> {
      throw videoRefusal('video_not_built')
    },
  })
}
