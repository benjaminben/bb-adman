// approvals.refresh (spec/approvals.md "Commands"): reads sign-offs back and keeps picture
// addresses fresh. Security class; agent policy deny. Stub (AP-5): refuses in prepare until
// AP-9 replaces the body.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import {
  approvalsCampaignInput,
  type ApprovalsRefreshReply,
} from '@/shared/schemas/commands/approvals'
import { approvalsRefusal } from '@/shared/approvals/messages'

export function approvalsRefresh(_deps: CoreDeps) {
  return defineCommand({
    name: 'approvals.refresh',
    input: approvalsCampaignInput,
    projectId: (input) => input.projectId,
    async prepare(): Promise<never> {
      throw approvalsRefusal('approvals_not_set_up')
    },
    run(): HandlerResult<ApprovalsRefreshReply> {
      throw approvalsRefusal('approvals_not_set_up')
    },
  })
}
