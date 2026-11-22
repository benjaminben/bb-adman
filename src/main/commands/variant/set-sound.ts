// variant.setSound (spec/phases/phase-07.md, "Clips and the track", Sound, A-184): the clips'
// own sound, one audio file, or none. Undo V. Agent deny.
// Stub (P7-1): refuses in prepare, before it reads or writes anything, until P7-12 fills it.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { variantSetSoundInput, type VariantReply } from '@/shared/schemas/commands/variant'
import { videoRefusal } from '@/shared/video/messages'

export function variantSetSound(_deps: CoreDeps) {
  return defineCommand({
    name: 'variant.setSound',
    input: variantSetSoundInput,
    projectId: (input) => input.projectId,
    prepare(): Promise<undefined> {
      return Promise.reject(videoRefusal('video_not_built'))
    },
    run(): HandlerResult<VariantReply> {
      throw videoRefusal('video_not_built')
    },
  })
}
