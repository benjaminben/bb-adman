// report.add (spec/phases/phase-08.md "Report", saved). System command: the export job saves
// its report row through it. Deny and internal, so no window and no agent can send it.
// Stub (P8-1): refuses in prepare, before it reads or writes anything, until P8-9 replaces it.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { reportAddInput, type ReportAddReply } from '@/shared/schemas/commands/export'
import { AppError } from '@/shared/schemas/result'

const NAME = 'report.add'
const notBuilt = () =>
  new AppError('RULE_VIOLATION', `${NAME} is not built yet.`, { reason: 'not_built' })

export function reportAdd(_deps: CoreDeps) {
  return defineCommand({
    name: NAME,
    internal: true,
    input: reportAddInput,
    projectId: (input) => input.projectId,
    prepare(): Promise<undefined> {
      return Promise.reject(notBuilt())
    },
    run(): HandlerResult<ReportAddReply> {
      throw notBuilt()
    },
  })
}
