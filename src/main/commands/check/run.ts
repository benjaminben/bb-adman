// check.run (spec/phases/phase-06.md). Runs and stores the checks of variants. Agent policy allow.
// Stub (P6-1): refuses in prepare, before it reads or writes anything, until P6-3 replaces the
// body.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { checkRunInput, type CheckRunReply } from '@/shared/schemas/commands/check'
import { AppError } from '@/shared/schemas/result'

const NAME = 'check.run'
const notBuilt = () =>
  new AppError('RULE_VIOLATION', `${NAME} is not built yet.`, { reason: 'not_built' })

export function checkRun(_deps: CoreDeps) {
  return defineCommand({
    name: NAME,
    input: checkRunInput,
    projectId: (input) => input.projectId,
    prepare(): Promise<undefined> {
      return Promise.reject(notBuilt())
    },
    run(): HandlerResult<CheckRunReply> {
      throw notBuilt()
    },
  })
}
