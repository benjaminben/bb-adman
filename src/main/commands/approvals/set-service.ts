// approvals.setService (spec/approvals.md "Commands"): the one writer of approvals.baseUrl.
// Security class; agent policy deny. Stub (AP-5): refuses until AP-6 replaces the body.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import {
  approvalsSetServiceInput,
  type ApprovalsSetServiceReply,
} from '@/shared/schemas/commands/approvals'
import { approvalsRefusal } from '@/shared/approvals/messages'

export function approvalsSetService(_deps: CoreDeps) {
  return defineCommand({
    name: 'approvals.setService',
    input: approvalsSetServiceInput,
    changesAppState: true,
    run(): HandlerResult<ApprovalsSetServiceReply> {
      throw approvalsRefusal('approvals_not_set_up')
    },
  })
}
