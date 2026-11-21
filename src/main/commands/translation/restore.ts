// translation.restore (spec/phases/phase-06.md). System command: the inverse of set and approve,
// and its own (A-160). Deny and internal. Stub (P6-1): refuses in prepare, before it reads or
// writes anything, until P6-4 replaces the body.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import {
  translationRestoreInput,
  type TranslationLayersReply,
} from '@/shared/schemas/commands/translation'
import { AppError } from '@/shared/schemas/result'

const NAME = 'translation.restore'
const notBuilt = () =>
  new AppError('RULE_VIOLATION', `${NAME} is not built yet.`, { reason: 'not_built' })

export function translationRestore(_deps: CoreDeps) {
  return defineCommand({
    name: NAME,
    internal: true,
    input: translationRestoreInput,
    projectId: (input) => input.projectId,
    prepare(): Promise<undefined> {
      return Promise.reject(notBuilt())
    },
    run(): HandlerResult<TranslationLayersReply> {
      throw notBuilt()
    },
  })
}
