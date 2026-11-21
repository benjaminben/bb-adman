// approvals.endLink, "Turn off link" (spec/approvals.md "Commands"). Security class; agent
// policy deny. Stub (AP-5): refuses in prepare until AP-8 replaces the body.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { approvalsCampaignInput } from '@/shared/schemas/commands/approvals'
import { approvalsRefusal } from '@/shared/approvals/messages'

export function approvalsEndLink(_deps: CoreDeps) {
  return defineCommand({
    name: 'approvals.endLink',
    input: approvalsCampaignInput,
    projectId: (input) => input.projectId,
    async prepare(): Promise<never> {
      throw approvalsRefusal('approvals_not_set_up')
    },
    run(): HandlerResult<Record<string, never>> {
      throw approvalsRefusal('approvals_not_set_up')
    },
  })
}
