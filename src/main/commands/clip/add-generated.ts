// clip.addGenerated (spec/phases/phase-07.md, "Clips and the track", A-182): the video job's
// clip, sent through jc.system. No undo entry. System command: deny and internal, so no window
// and no agent can send it.
// Stub (P7-1): refuses in prepare, before it reads or writes anything, until P7-9 fills it.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { clipAddGeneratedInput, type ClipAddGeneratedReply } from '@/shared/schemas/commands/clip'
import { videoRefusal } from '@/shared/video/messages'

export function clipAddGenerated(_deps: CoreDeps) {
  return defineCommand({
    name: 'clip.addGenerated',
    internal: true,
    input: clipAddGeneratedInput,
    projectId: (input) => input.projectId,
    prepare(): Promise<undefined> {
      return Promise.reject(videoRefusal('video_not_built'))
    },
    run(): HandlerResult<ClipAddGeneratedReply> {
      throw videoRefusal('video_not_built')
    },
  })
}
