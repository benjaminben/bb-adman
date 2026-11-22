// variant.setFormat (spec/data-rules.md, "Changing a variant's format"): image to video and
// back, with the grid test. Undo V. Agent allow [D-025].
// Stub (P7-1): refuses in prepare, before it reads or writes anything, until P7-10 fills it.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { variantSetFormatInput, type VariantReply } from '@/shared/schemas/commands/variant'
import { videoRefusal } from '@/shared/video/messages'

export function variantSetFormat(_deps: CoreDeps) {
  return defineCommand({
    name: 'variant.setFormat',
    input: variantSetFormatInput,
    projectId: (input) => input.projectId,
    prepare(): Promise<undefined> {
      return Promise.reject(videoRefusal('video_not_built'))
    },
    run(): HandlerResult<VariantReply> {
      throw videoRefusal('video_not_built')
    },
  })
}
