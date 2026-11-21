// layer.updateMany (spec/ai-jobs.md "Layout proposal"). P4-1 stub, replaced by P4-7: it refuses
// in prepare, so nothing is written.
import { defineCommand } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { layerUpdateManyInput } from '@/shared/schemas/commands/layer'
import { AppError } from '@/shared/schemas/result'

const notBuilt = (): never => {
  throw new AppError('INVALID_INPUT', 'That provider cannot do this yet.')
}

export function layerUpdateMany(_deps: CoreDeps) {
  return defineCommand({
    name: 'layer.updateMany',
    input: layerUpdateManyInput,
    projectId: (input) => input.projectId,
    prepare: async () => notBuilt(),
    run: () => notBuilt(),
  })
}
