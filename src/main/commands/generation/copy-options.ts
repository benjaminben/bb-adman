// generation.copyOptions (spec/ai-jobs.md "Copy options"). P4-1 stub, replaced by P4-8: it
// refuses in prepare, so no job row is written and no provider is called.
import { defineCommand } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { generationCopyOptionsInput } from '@/shared/schemas/commands/generation'
import { AppError } from '@/shared/schemas/result'

const notBuilt = (): never => {
  throw new AppError('INVALID_INPUT', 'That provider cannot do this yet.')
}

export function generationCopyOptions(_deps: CoreDeps) {
  return defineCommand({
    name: 'generation.copyOptions',
    input: generationCopyOptionsInput,
    projectId: (input) => input.projectId,
    prepare: async () => notBuilt(),
    run: () => notBuilt(),
  })
}
