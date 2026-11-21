// layer.revert (spec/links-and-sync.md): system command, the inverse of an edit that changed an
// override list. Agent policy deny. Stub (P5-1, A-149): refuses in run until P5-3 replaces the
// body.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { layerRevertInput, type LayerUpdateManyReply } from '@/shared/schemas/commands/layer'
import { AppError } from '@/shared/schemas/result'

export function layerRevert(_deps: CoreDeps) {
  return defineCommand({
    name: 'layer.revert',
    internal: true,
    input: layerRevertInput,
    projectId: (input) => input.projectId,
    run(): HandlerResult<LayerUpdateManyReply> {
      throw new AppError('RULE_VIOLATION', 'This is not built yet.', { reason: 'not_built' })
    },
  })
}
