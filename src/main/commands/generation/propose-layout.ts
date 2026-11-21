// generation.proposeLayout (spec/ai-jobs.md "Layout proposal"). P4-1 stub, replaced by P4-7:
// it refuses in prepare, so no job row is written and no provider is called.
import { defineCommand } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { generationProposeLayoutInput } from '@/shared/schemas/commands/generation'
import { AppError } from '@/shared/schemas/result'

const notBuilt = (): never => {
  throw new AppError('INVALID_INPUT', 'That provider cannot do this yet.')
}

export function generationProposeLayout(_deps: CoreDeps) {
  return defineCommand({
    name: 'generation.proposeLayout',
    input: generationProposeLayoutInput,
    projectId: (input) => input.projectId,
    prepare: async () => notBuilt(),
    run: () => notBuilt(),
  })
}
