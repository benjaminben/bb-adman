// approvals.publish, "Update gallery" (spec/approvals-commands.md "approvals.publish").
// Security class; agent policy deny. prepare makes the shared refusals (a live link, the bucket
// and its keys), checks the gallery, then draws, uploads, signs and replaces the gallery on the
// service, making and sending video clips too (src/main/approvals/publish.ts); run replaces the local gallery rows and sets
// published_at. approvals.changed goes after the commit.
// Half-done states: when the service took the gallery but run failed, the local rows stay as
// they were; the next press draws the variants they call changed again and sends the whole
// gallery once more.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import {
  approvalsCampaignInput,
  type ApprovalsPublishReply,
} from '@/shared/schemas/commands/approvals'
import { createApprovalsClient } from '@/main/approvals/client'
import { afterCommit } from '@/main/approvals/after-commit'
import {
  linkIsLive,
  publishLocalGallery,
  readLink,
  readVariants,
} from '@/main/approvals/local-store'
import {
  campaignVariants,
  checkGallery,
  publishGallery,
  type Published,
} from '@/main/approvals/publish'
import { requireApprovalsReady } from '@/main/approvals/ready'
import { requireCampaign } from '@/main/queries/campaign-reads'

export function approvalsPublish(deps: CoreDeps) {
  return defineCommand({
    name: 'approvals.publish',
    input: approvalsCampaignInput,
    projectId: (input) => input.projectId,
    async prepare(ctx, input): Promise<Published> {
      const db = ctx.project.db
      const service = requireApprovalsReady(deps, db, input.campaignId, {
        bucket: true,
        link: 'live',
        linkIsLive: () => linkIsLive(db, input.campaignId, deps.log),
      })
      const pair = { projectId: input.projectId, campaignId: input.campaignId }
      const campaign = requireCampaign(db, input.campaignId)
      const variants = campaignVariants(deps, db, input.campaignId)
      checkGallery(pair, campaign.name, variants)
      const published = new Map(
        readVariants(db, input.campaignId, deps.log).map((r) => [r.variantId, r]),
      )
      const client = createApprovalsClient(service, {
        allowLocalHttp: deps.devTools,
        log: deps.log,
      })
      return publishGallery(deps, {
        project: ctx.project,
        pair,
        client,
        campaignName: campaign.name,
        variants,
        published,
        signal: new AbortController().signal,
        onStep: () => undefined,
      })
    },
    run(ctx, input, prepared): HandlerResult<ApprovalsPublishReply> {
      const { projectId, campaignId } = input
      const now = deps.now().toISOString()
      publishLocalGallery(ctx.project.db, campaignId, prepared.rows, now)
      afterCommit(
        deps.log,
        { projectId, campaignId, command: 'approvals.publish' },
        () => readLink(ctx.project.db, campaignId, deps.log)?.publishedAt === now,
        () => deps.approvals.changed(projectId, campaignId),
      )
      return {
        data: { variants: prepared.rows.length, drawn: prepared.drawn, clips: prepared.clips },
        log: { campaignId },
      }
    },
  })
}
