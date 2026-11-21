// approvals.refresh (spec/approvals-commands.md "approvals.refresh"): reads sign-offs back and
// keeps picture addresses fresh. Security class; agent policy deny. prepare makes the shared
// refusals (a live link, no bucket needed) and does the network work
// (src/main/approvals/refresh.ts); run writes the local tables.
// A gone link: a throw inside run would roll its writes back, so run ends the link here and
// returns { changed: true, gone: true }; nothing in run can throw after those writes.
// Forgetting the password and sending approvals.changed happen after the commit, and only
// when it happened (after-commit.ts); forgetting is best effort.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import {
  approvalsCampaignInput,
  type ApprovalsRefreshReply,
} from '@/shared/schemas/commands/approvals'
import { createApprovalsClient } from '@/main/approvals/client'
import { afterCommit } from '@/main/approvals/after-commit'
import { endLocalLink, linkIsLive, readLink, refreshLocalLink } from '@/main/approvals/local-store'
import { readBack, type ReadBack } from '@/main/approvals/refresh'
import { requireApprovalsReady } from '@/main/approvals/ready'

export function approvalsRefresh(deps: CoreDeps) {
  return defineCommand({
    name: 'approvals.refresh',
    input: approvalsCampaignInput,
    projectId: (input) => input.projectId,
    async prepare(ctx, input): Promise<ReadBack> {
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
      return readBack(deps, db, client, pair)
    },
    run(ctx, input, prepared): HandlerResult<ApprovalsRefreshReply> {
      const { projectId, campaignId } = input
      const db = ctx.project.db
      const now = deps.now().toISOString()
      const ids = { projectId, campaignId, command: 'approvals.refresh' }
      const log = { campaignId }
      if (prepared.gone) {
        endLocalLink(db, campaignId, now, null)
        const ended = () => readLink(db, campaignId, deps.log)?.endedAt === now
        afterCommit(deps.log, ids, ended, () =>
          deps.approvals.passwords.forget(projectId, campaignId),
        )
        afterCommit(deps.log, ids, ended, () => deps.approvals.changed(projectId, campaignId))
        return { data: { changed: true, gone: true }, log }
      }
      const changed = refreshLocalLink(db, campaignId, prepared.signoffs, prepared.renewed, now)
      if (changed) {
        afterCommit(
          deps.log,
          ids,
          () => readLink(db, campaignId, deps.log)?.checkedAt === now,
          () => deps.approvals.changed(projectId, campaignId),
        )
      }
      return { data: { changed, gone: false }, log }
    },
  })
}
