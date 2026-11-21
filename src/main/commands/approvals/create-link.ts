// approvals.createLink (spec/approvals.md "Commands"). Security class; agent policy deny. Its
// network work is in prepare, its table writes in run. Stub (AP-5): refuses in prepare until
// AP-8 replaces the body.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import {
  approvalsCreateLinkInput,
  type ApprovalsCreateLinkReply,
} from '@/shared/schemas/commands/approvals'
import { approvalsRefusal } from '@/shared/approvals/messages'

export function approvalsCreateLink(_deps: CoreDeps) {
  return defineCommand({
    name: 'approvals.createLink',
    input: approvalsCreateLinkInput,
    projectId: (input) => input.projectId,
    async prepare(): Promise<never> {
      throw approvalsRefusal('approvals_not_set_up')
    },
    run(): HandlerResult<ApprovalsCreateLinkReply> {
      throw approvalsRefusal('approvals_not_set_up')
    },
  })
}
