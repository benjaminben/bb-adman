// job.cancel (SPEC 4.2, 6.11.2; FR-152, FR-215, FR-281). The refusals are decided here, in
// the command. The runner then cancels once this command's transaction has ended, and the
// window follows the job through job.updated.
import { defineCommand } from '../types'
import type { CoreDeps } from '../../core-deps'
import { cancelRefusal } from '../../jobs/cancel'
import { requireJob } from './find-job'
import { jobCancelInput } from '../../../shared/schemas/commands/job'

export function jobCancel(deps: Pick<CoreDeps, 'jobs' | 'providers' | 'log'>) {
  return defineCommand({
    name: 'job.cancel',
    input: jobCancelInput,
    projectId: (input) => input.projectId,
    run(ctx, input) {
      const row = requireJob(ctx.project, input.jobId)
      const refusal = cancelRefusal(
        row,
        deps.providers.find((p) => p.id === row.provider),
      )
      if (refusal) throw refusal
      deps.jobs.cancel(input.projectId, input.jobId).catch(() => {
        deps.log.write({
          level: 'warn',
          event: 'job',
          name: 'job.cancel',
          actor: 'system',
          projectId: input.projectId,
          jobId: input.jobId,
          ok: false,
          message: 'The job ended before it could be cancelled.',
        })
      })
      return { data: { jobId: input.jobId }, log: { campaignId: row.campaignId ?? undefined } }
    },
  })
}
