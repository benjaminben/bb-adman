// clip.add (spec/phases/phase-07.md, "Clips and the track"): one clip on the variant's track.
// Undo V. Agent deny.
// Stub (P7-1): refuses in prepare, before it reads or writes anything, until P7-9 fills it.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { clipAddInput, type ClipReply } from '@/shared/schemas/commands/clip'
import { videoRefusal } from '@/shared/video/messages'

export function clipAdd(_deps: CoreDeps) {
  return defineCommand({
    name: 'clip.add',
    input: clipAddInput,
    projectId: (input) => input.projectId,
    prepare(): Promise<undefined> {
      return Promise.reject(videoRefusal('video_not_built'))
    },
    run(): HandlerResult<ClipReply> {
      throw videoRefusal('video_not_built')
    },
  })
}
