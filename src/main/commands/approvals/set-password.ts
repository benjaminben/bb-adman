// approvals.setPassword (spec/approvals.md "approvals.setPassword"). Security class; agent
// policy deny. prepare checks the password, makes the shared refusals (no bucket needed, a live
// link needed) and sets it on the service, which ends every visitor session; run keeps it. No
// table changes, so no approvals.changed.
// A link the service no longer has: approval_link_gone and nothing changes here; the next
// refresh turns the local link off. Set on the service but not kept (the store failed): the
// user is shown the failure and sets a password again.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import type { ApprovalsSetPasswordReply } from '@/shared/schemas/commands/approvals'
import { approvalsRefusal } from '@/shared/approvals/messages'
import { createApprovalsClient } from '@/main/approvals/client'
import { linkIsLive } from '@/main/approvals/local-store'
import { requireApprovalsReady } from '@/main/approvals/ready'
import { choosePassword, linkPasswordInput } from './password-input'

export function approvalsSetPassword(deps: CoreDeps) {
  return defineCommand({
    name: 'approvals.setPassword',
    input: linkPasswordInput,
    projectId: (input) => input.projectId,
    async prepare(ctx, input): Promise<{ password: string }> {
      const password = choosePassword(input.password)
      const db = ctx.project.db
      const service = requireApprovalsReady(deps, db, input.campaignId, {
        bucket: false,
        link: 'live',
        linkIsLive: () => linkIsLive(db, input.campaignId, deps.log),
      })
      const client = createApprovalsClient(service, {
        allowLocalHttp: deps.devTools,
        log: deps.log,
      })
      const pair = { projectId: input.projectId, campaignId: input.campaignId }
      if (!(await client.setPassword(pair, password))) throw approvalsRefusal('approval_link_gone')
      return { password }
    },
    run(_ctx, input, prepared): HandlerResult<ApprovalsSetPasswordReply> {
      deps.approvals.passwords.keep(input.projectId, input.campaignId, prepared.password)
      return { data: {}, log: { campaignId: input.campaignId } }
    },
  })
}
