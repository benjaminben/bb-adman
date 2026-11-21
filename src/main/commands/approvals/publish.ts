// approvals.publish, "Update gallery" (spec/approvals.md "Commands"). Security class; agent
// policy deny. Stub (AP-5): refuses in prepare until AP-9 replaces the body.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import {
  approvalsCampaignInput,
  type ApprovalsPublishReply,
} from '@/shared/schemas/commands/approvals'
import { approvalsRefusal } from '@/shared/approvals/messages'

export function approvalsPublish(_deps: CoreDeps) {
  return defineCommand({
    name: 'approvals.publish',
    input: approvalsCampaignInput,
    projectId: (input) => input.projectId,
    async prepare(): Promise<never> {
      throw approvalsRefusal('approvals_not_set_up')
    },
    run(): HandlerResult<ApprovalsPublishReply> {
      throw approvalsRefusal('approvals_not_set_up')
    },
  })
}
