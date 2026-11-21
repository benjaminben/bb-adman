// translation.propose (spec/phases/phase-06.md). Starts one translation job per direction and
// language. Agent policy deny (A-169). Stub (P6-1): refuses in prepare, before it reads or writes
// anything, until P6-6 replaces the body.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import {
  translationProposeInput,
  type TranslationProposeReply,
} from '@/shared/schemas/commands/translation'
import { AppError } from '@/shared/schemas/result'

const NAME = 'translation.propose'
const notBuilt = () =>
  new AppError('RULE_VIOLATION', `${NAME} is not built yet.`, { reason: 'not_built' })

export function translationPropose(_deps: CoreDeps) {
  return defineCommand({
    name: NAME,
    input: translationProposeInput,
    projectId: (input) => input.projectId,
    prepare(): Promise<undefined> {
      return Promise.reject(notBuilt())
    },
    run(): HandlerResult<TranslationProposeReply> {
      throw notBuilt()
    },
  })
}
