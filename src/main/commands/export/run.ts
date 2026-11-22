// export.run (spec/phases/phase-08.md "The output folder", "Export run"). Security class: takes
// a folder path from the window. Agent policy deny. prepare checks the ads, the folder (its real
// path is the root from then on) and the warnings; run refuses a second export of the campaign
// and queues the job. The plan, with the root and the reason, stays in memory (A-195): the job
// row, the log line and the reply hold no path and no reason text.
import { defineCommand, type ProjectContext } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import type { ProjectHandle } from '@/main/db/project-file'
import type { ExportPlan } from '@/main/export/types'
import { EXPORT_VARIANT_NOT_FOUND, exportRefusal } from '@/shared/export/messages'
import {
  exportRunInput,
  type ExportRunInput,
  type ExportRunReply,
  type ExportWarning,
} from '@/shared/schemas/commands/export'
import { AppError } from '@/shared/schemas/result'
import { checkOutputDir } from './output-dir'
import { warningsGate } from './warnings'

type Deps = Pick<CoreDeps, 'userDataDir' | 'jobs' | 'export' | 'log' | 'now'>
type Prepared = { root: string; warningsSeen: ExportWarning[] }

// Each ad must be a variant of the campaign.
function requireVariants(project: ProjectHandle, campaignId: string, variantIds: string[]) {
  const campaignOf = project.db.prepare(
    `SELECT d.campaign_id AS campaignId
     FROM variant v JOIN direction d ON d.id = v.direction_id WHERE v.id = ?`,
  )
  for (const id of variantIds) {
    const row = campaignOf.get(id) as { campaignId: string } | undefined
    if (row?.campaignId !== campaignId) throw new AppError('NOT_FOUND', EXPORT_VARIANT_NOT_FOUND)
  }
}

// A-197: one export per campaign at a time. Checked in the transaction, so two calls cannot
// both pass.
function refuseRunningExport(ctx: ProjectContext, campaignId: string) {
  const running = ctx.project.db
    .prepare(
      `SELECT 1 FROM job WHERE kind = 'export' AND campaign_id = ?
       AND status IN ('queued', 'running')`,
    )
    .get(campaignId)
  if (running) throw exportRefusal('export_running')
}

function planOf(deps: Deps, input: ExportRunInput, prepared: Prepared): ExportPlan {
  return {
    projectId: input.projectId,
    campaignId: input.campaignId,
    root: prepared.root,
    variantIds: input.variantIds,
    imageFormat: input.imageFormat,
    jpgQuality: input.jpgQuality,
    fps: input.fps,
    warningsSeen: prepared.warningsSeen,
    proceeded: input.proceedDespiteWarnings
      ? { at: deps.now().toISOString(), reason: input.reason || null }
      : null,
  }
}

export function exportRun(deps: Deps) {
  return defineCommand({
    name: 'export.run',
    input: exportRunInput,
    projectId: (input) => input.projectId,
    async prepare(ctx, input): Promise<Prepared> {
      requireVariants(ctx.project, input.campaignId, input.variantIds)
      const root = await checkOutputDir(deps, ctx.project, input.outputDir, input.campaignId)
      const warningsSeen = await warningsGate(deps.export.checks, ctx.project, input)
      return { root, warningsSeen }
    },
    run(ctx, input, prepared) {
      refuseRunningExport(ctx, input.campaignId)
      const { variantIds, imageFormat, jpgQuality, fps, proceedDespiteWarnings } = input
      const jobId = deps.jobs.enqueue(ctx, {
        kind: 'export',
        campaignId: input.campaignId,
        variantId: null,
        layerId: null,
        slot: null,
        provider: 'adman',
        model: '',
        request: { variantIds, imageFormat, jpgQuality, fps, proceedDespiteWarnings },
        startedBy: ctx.actor === 'agent' ? 'agent' : 'user',
      })
      deps.export.plans.set(jobId, planOf(deps, input, prepared))
      deps.log.write({
        level: 'info',
        event: 'command',
        name: 'export.run',
        actor: ctx.actor,
        ok: true,
        projectId: input.projectId,
        campaignId: input.campaignId,
        jobId,
        message: 'Export queued.',
        context: { ads: variantIds.length, proceeded: proceedDespiteWarnings },
      })
      const data: ExportRunReply = { jobId }
      return { data, log: { campaignId: input.campaignId } }
    },
  })
}
