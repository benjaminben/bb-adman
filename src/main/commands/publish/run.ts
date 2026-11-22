// publish.run (spec/phases/phase-09.md "Publishing"; A-221, A-225, A-226). Agent policy deny.
// prepare makes every refusal in its order: unknown campaign, campaign ID form, the storage
// (fake listed; S3 settings, then keys; Dropbox signed in and its saved folder), a publish of
// the campaign under way, files in the campaign folder without the replace confirmation (the
// file count decides, never the old manifest's "other project", which a project file or a
// shared bucket can fake), then warnings without "publish anyway". run checks the running
// publish again inside the transaction and queues the job. The plan, with the reason text,
// stays in memory (publish-plans.ts): the job row, the log line and the reply hold neither.
import { defineCommand, type PrepareContext } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import type Database from 'better-sqlite3'
import { requireCampaign } from '@/main/queries/campaign-reads'
import { publishRefusal, PUBLISH_REFUSALS } from '@/shared/publish/messages'
import { isCampaignIdForm } from '@/shared/publish/paths'
import {
  publishRunInput,
  type PublishRunInput,
  type PublishRunReply,
} from '@/shared/schemas/commands/publish'
import { AppError } from '@/shared/schemas/result'
import type { PublishWarning } from '@/main/publish/ports'
import { publishPlans } from '@/main/publish/publish-plans'
import { publishedFileCount, requireStorageReady, warningsOf } from './run-checks'

function refuseRunningPublish(db: Database.Database, campaignId: string): void {
  const running = db
    .prepare(
      `SELECT 1 FROM job WHERE kind = 'publish' AND campaign_id = ?
       AND status IN ('queued', 'running')`,
    )
    .get(campaignId)
  if (running) throw publishRefusal('publish_running')
}

function hasWarnings(warnings: PublishWarning[]): AppError {
  const { code, message } = PUBLISH_REFUSALS.publish_has_warnings
  return new AppError(code, message, { reason: 'publish_has_warnings', warnings })
}

async function checks(deps: CoreDeps, ctx: PrepareContext, input: PublishRunInput) {
  requireCampaign(ctx.project.db, input.campaignId)
  if (!isCampaignIdForm(input.campaignId)) throw publishRefusal('campaign_id_unsafe')
  requireStorageReady(deps, input.storage)
  refuseRunningPublish(ctx.project.db, input.campaignId)
  const files = await publishedFileCount(deps, input.storage, input.campaignId)
  if (files > 0 && !input.replaceConfirmed) throw publishRefusal('replace_not_confirmed')
  const warnings = await warningsOf(deps, input)
  if (warnings.length > 0 && !input.proceedDespiteWarnings) throw hasWarnings(warnings)
}

export function publishRun(deps: CoreDeps) {
  return defineCommand({
    name: 'publish.run',
    input: publishRunInput,
    projectId: (input) => input.projectId,
    async prepare(ctx, input): Promise<undefined> {
      await checks(deps, ctx, input)
      return undefined
    },
    run(ctx, input) {
      refuseRunningPublish(ctx.project.db, input.campaignId)
      const { storage, replaceConfirmed, proceedDespiteWarnings } = input
      const jobId = deps.jobs.enqueue(ctx, {
        kind: 'publish',
        campaignId: input.campaignId,
        variantId: null,
        layerId: null,
        slot: null,
        provider: storage,
        model: '',
        request: { storage, replaceConfirmed, proceedDespiteWarnings },
        startedBy: ctx.actor === 'agent' ? 'agent' : 'user',
      })
      publishPlans(deps).set(jobId, {
        projectId: input.projectId,
        campaignId: input.campaignId,
        storage,
        replaceConfirmed,
        proceedDespiteWarnings,
        proceedReason: input.proceedReason || null,
      })
      deps.log.write({
        level: 'info',
        event: 'command',
        name: 'publish.run',
        actor: ctx.actor,
        ok: true,
        projectId: input.projectId,
        campaignId: input.campaignId,
        jobId,
        message: 'Publish queued.',
        context: { storage, proceeded: proceedDespiteWarnings },
      })
      const data: PublishRunReply = { jobId }
      return { data, log: { campaignId: input.campaignId } }
    },
  })
}
