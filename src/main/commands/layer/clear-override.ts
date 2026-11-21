// layer.clearOverride (spec/links-and-sync.md): removes override paths and writes the master's
// values. Agent policy deny. Stub (P5-1, A-149): refuses in run until P5-3 replaces the body.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { layerClearOverrideInput, type LayerReply } from '@/shared/schemas/commands/layer'
import { AppError } from '@/shared/schemas/result'

export function layerClearOverride(_deps: CoreDeps) {
  return defineCommand({
    name: 'layer.clearOverride',
    input: layerClearOverrideInput,
    projectId: (input) => input.projectId,
    run(): HandlerResult<LayerReply> {
      throw new AppError('RULE_VIOLATION', 'This is not built yet.', { reason: 'not_built' })
    },
  })
}
