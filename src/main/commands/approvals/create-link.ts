// approvals.createLink (spec/approvals.md "approvals.createLink"). Security class; agent policy
// deny. prepare checks the password, makes the shared refusals and talks to the service; run
// writes the local link and keeps the password.
// Half-done states: when the service made the link but run failed (the transaction rolls back,
// so no local row), the next press gets 409 link_exists and takes the link over with its new
// password. A 409 whose link is gone before it can be read fails as 'other'; the next press
// makes a new link.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import type { ApprovalsCreateLinkReply } from '@/shared/schemas/commands/approvals'
import { createApprovalsClient, type ApprovalsClient } from '@/main/approvals/client'
import { ApprovalsFailure, logFailure } from '@/main/approvals/failure'
import { linkIsLive, readLink, startLocalLink } from '@/main/approvals/local-store'
import { requireApprovalsReady } from '@/main/approvals/ready'
import { requireCampaign } from '@/main/queries/campaign-reads'
import { afterCommit } from '@/main/approvals/after-commit'
import { choosePassword, linkPasswordInput, requireCanKeep } from './password-input'

type Pair = { projectId: string; campaignId: string }
type Prepared = { slug: string; password: string }

// 409: a copy of this project made the link, or the local row was lost. This password is set
// on it (ending every visitor session), then its slug is read.
async function takeOver(
  deps: Pick<CoreDeps, 'log'>,
  client: ApprovalsClient,
  pair: Pair,
  password: string,
): Promise<string> {
  const state = (await client.setPassword(pair, password)) ? await client.getLink(pair) : null
  if (state !== null) return state.slug
  const failure = new ApprovalsFailure('other', 404)
  logFailure(deps.log, 'getLink', failure)
  throw failure
}

export function approvalsCreateLink(deps: CoreDeps) {
  return defineCommand({
    name: 'approvals.createLink',
    input: linkPasswordInput,
    projectId: (input) => input.projectId,
    async prepare(ctx, input): Promise<Prepared> {
      const password = choosePassword(input.password)
      const db = ctx.project.db
      const service = requireApprovalsReady(deps, db, input.campaignId, {
        bucket: true,
        link: 'none',
        linkIsLive: () => linkIsLive(db, input.campaignId, deps.log),
      })
      requireCanKeep(deps.approvals.passwords)
      const campaign = requireCampaign(db, input.campaignId)
      const client = createApprovalsClient(service, {
        allowLocalHttp: deps.devTools,
        log: deps.log,
      })
      const pair = { projectId: input.projectId, campaignId: input.campaignId }
      const made = await client.createLink({ ...pair, campaignName: campaign.name, password })
      const slug = made === 'exists' ? await takeOver(deps, client, pair, password) : made.slug
      return { slug, password }
    },
    run(ctx, input, prepared): HandlerResult<ApprovalsCreateLinkReply> {
      startLocalLink(ctx.project.db, input.campaignId, prepared.slug, deps.now().toISOString())
      // Last, so a password store that cannot save rolls the link row back with it.
      deps.approvals.passwords.keep(input.projectId, input.campaignId, prepared.password)
      const { projectId, campaignId } = input
      afterCommit(
        deps.log,
        { projectId, campaignId, command: 'approvals.createLink' },
        () => readLink(ctx.project.db, campaignId, deps.log)?.slug === prepared.slug,
        () => deps.approvals.changed(projectId, campaignId),
      )
      return { data: { slug: prepared.slug }, log: { campaignId: input.campaignId } }
    },
  })
}
