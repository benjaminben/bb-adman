// clip.reorder (spec/phases/phase-07.md, "Clips and the track", A-181): every clip of the
// variant, laid back to back from the earliest start in the given order. Undo V. Agent deny.
// Stub (P7-1): refuses in prepare, before it reads or writes anything, until P7-9 fills it.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { clipReorderInput, type ClipReorderReply } from '@/shared/schemas/commands/clip'
import { videoRefusal } from '@/shared/video/messages'

export function clipReorder(_deps: CoreDeps) {
  return defineCommand({
    name: 'clip.reorder',
    input: clipReorderInput,
    projectId: (input) => input.projectId,
    prepare(): Promise<undefined> {
      return Promise.reject(videoRefusal('video_not_built'))
    },
    run(): HandlerResult<ClipReorderReply> {
      throw videoRefusal('video_not_built')
    },
  })
}
