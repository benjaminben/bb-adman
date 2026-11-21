// translation.approve (spec/phases/phase-06.md). Approves proposed translations (A-159). Agent
// policy deny. Stub (P6-1): refuses in prepare, before it reads or writes anything, until P6-4
// replaces the body.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import {
  translationApproveInput,
  type TranslationLayersReply,
} from '@/shared/schemas/commands/translation'
import { AppError } from '@/shared/schemas/result'

const NAME = 'translation.approve'
const notBuilt = () =>
  new AppError('RULE_VIOLATION', `${NAME} is not built yet.`, { reason: 'not_built' })

export function translationApprove(_deps: CoreDeps) {
  return defineCommand({
    name: NAME,
    input: translationApproveInput,
    projectId: (input) => input.projectId,
    prepare(): Promise<undefined> {
      return Promise.reject(notBuilt())
    },
    run(): HandlerResult<TranslationLayersReply> {
      throw notBuilt()
    },
  })
}
