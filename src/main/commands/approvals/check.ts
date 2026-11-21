// approvals.check (spec/approvals.md "Commands"): asks the service's health route. Security
// class; agent policy deny. Stub (AP-5): refuses until AP-6 replaces the body.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { approvalsCheckInput, type ApprovalsCheckReply } from '@/shared/schemas/commands/approvals'
import { approvalsRefusal } from '@/shared/approvals/messages'

export function approvalsCheck(_deps: CoreDeps) {
  return defineCommand({
    name: 'approvals.check',
    input: approvalsCheckInput,
    run(): HandlerResult<ApprovalsCheckReply> {
      throw approvalsRefusal('approvals_not_set_up')
    },
  })
}
