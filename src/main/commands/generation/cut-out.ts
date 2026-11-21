// generation.cutOut (spec/ai-jobs.md "Cut-out"). P4-1 stub, replaced by P4-11: it refuses in
// prepare, so no job row is written and no provider is called.
import { defineCommand } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { generationCutOutInput } from '@/shared/schemas/commands/generation'
import { AppError } from '@/shared/schemas/result'

const notBuilt = (): never => {
  throw new AppError('INVALID_INPUT', 'That provider cannot do this yet.')
}

export function generationCutOut(_deps: CoreDeps) {
  return defineCommand({
    name: 'generation.cutOut',
    input: generationCutOutInput,
    projectId: (input) => input.projectId,
    prepare: async () => notBuilt(),
    run: () => notBuilt(),
  })
}
