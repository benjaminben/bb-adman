// translation.exportSheet (spec/phases/phase-06.md). Writes the translation sheet to a path from
// outside (A-164). Agent policy deny. Stub (P6-1): refuses in prepare, before it reads or writes
// anything, until P6-7 replaces the body.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import {
  translationExportSheetInput,
  type TranslationExportSheetReply,
} from '@/shared/schemas/commands/translation'
import { AppError } from '@/shared/schemas/result'

const NAME = 'translation.exportSheet'
const notBuilt = () =>
  new AppError('RULE_VIOLATION', `${NAME} is not built yet.`, { reason: 'not_built' })

export function translationExportSheet(_deps: CoreDeps) {
  return defineCommand({
    name: NAME,
    input: translationExportSheetInput,
    projectId: (input) => input.projectId,
    prepare(): Promise<undefined> {
      return Promise.reject(notBuilt())
    },
    run(): HandlerResult<TranslationExportSheetReply> {
      throw notBuilt()
    },
  })
}
