// approvals.setPassword (spec/approvals.md "Commands"). Security class; agent policy deny. No
// table changes. Stub (AP-5): refuses in prepare until AP-8 replaces the body.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import {
  approvalsSetPasswordInput,
  type ApprovalsSetPasswordReply,
} from '@/shared/schemas/commands/approvals'
import { approvalsRefusal } from '@/shared/approvals/messages'

export function approvalsSetPassword(_deps: CoreDeps) {
  return defineCommand({
    name: 'approvals.setPassword',
    input: approvalsSetPasswordInput,
    projectId: (input) => input.projectId,
    async prepare(): Promise<never> {
      throw approvalsRefusal('approvals_not_set_up')
    },
    run(): HandlerResult<ApprovalsSetPasswordReply> {
      throw approvalsRefusal('approvals_not_set_up')
    },
  })
}
