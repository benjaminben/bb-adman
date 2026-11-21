// translation.write (spec/phases/phase-06.md). System command: writes a translation job's cleaned
// answer (A-155). Deny and internal. Stub (P6-1): refuses in prepare, before it reads or writes
// anything, until P6-6 replaces the body.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import {
  translationWriteInput,
  type TranslationWriteReply,
} from '@/shared/schemas/commands/translation'
import { AppError } from '@/shared/schemas/result'

const NAME = 'translation.write'
const notBuilt = () =>
  new AppError('RULE_VIOLATION', `${NAME} is not built yet.`, { reason: 'not_built' })

export function translationWrite(_deps: CoreDeps) {
  return defineCommand({
    name: NAME,
    internal: true,
    input: translationWriteInput,
    projectId: (input) => input.projectId,
    prepare(): Promise<undefined> {
      return Promise.reject(notBuilt())
    },
    run(): HandlerResult<TranslationWriteReply> {
      throw notBuilt()
    },
  })
}
