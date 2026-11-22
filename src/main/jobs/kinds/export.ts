// The export job kind (spec/phases/phase-08.md "Export run"; background [D-036]). Security
// class short. The plan, with the output folder, lives only in memory (A-195): a row with no
// plan (a retried row, a row from a crafted file) fails with export_not_retried and touches
// nothing. Every write goes through exportTarget(plan.root).
import { exportTarget } from '@/main/export/target'
import { runExport, type ExportResult } from '@/main/export/run-export'
import type { JobKindHandler, JobRunContext } from '@/main/jobs/types'
import { ProviderCancelled, ProviderFailure } from '@/main/providers/types'
import type { JobRow } from '@/shared/schemas/rows/job'

// error_detail holds the reason name, as for a local cause (spec/jobs.md "Errors inside a job").
const notRetried = () => new ProviderFailure({ kind: 'other', detail: 'export_not_retried' })

async function runExportJob(jc: JobRunContext, job: JobRow): Promise<ExportResult> {
  const plan = jc.deps.export.plans.take(job.id)
  if (!plan || plan.projectId !== jc.projectId || plan.campaignId !== job.campaignId) {
    throw notRetried()
  }
  const project = jc.deps.projects.get(jc.projectId)
  if (!project) throw new ProviderCancelled()
  const result = await runExport(jc, plan, exportTarget(plan.root), { project })
  jc.deps.log.write({
    level: 'info',
    event: 'job',
    name: 'export.done',
    actor: 'system',
    projectId: jc.projectId,
    campaignId: plan.campaignId,
    jobId: job.id,
    ok: true,
    message: 'Export finished',
    context: { exported: result.exported, failed: result.failed },
  })
  return result
}

export function exportKind(): JobKindHandler {
  return { kind: 'export', run: runExportJob }
}
