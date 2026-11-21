// brief.extract (spec/ai-jobs.md "Brief reading"). P4-1 stub, replaced by P4-8: it refuses in
// prepare, so no file is read, no job row is written and no provider is called.
import { defineCommand } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { briefExtractInput } from '@/shared/schemas/commands/brief'
import { AppError } from '@/shared/schemas/result'

const notBuilt = (): never => {
  throw new AppError('INVALID_INPUT', 'That provider cannot do this yet.')
}

export function briefExtract(_deps: CoreDeps) {
  return defineCommand({
    name: 'brief.extract',
    input: briefExtractInput,
    projectId: (input) => input.projectId,
    prepare: async () => notBuilt(),
    run: () => notBuilt(),
  })
}
