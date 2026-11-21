// job.markSeen (SPEC 4.2 notes, 3.3; FR-218): sets seen_at on each named job that succeeded
// and has none. Marking twice is not an error. Bumps no rev. The write is the runner's
// (SPEC 3.6 "Jobs" item 3 [1.38]), which emits job.updated for each row it marked.
import { defineCommand } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { requireJob, wrongState } from './find-job'
import { jobMarkSeenInput } from '@/shared/schemas/commands/job'

export function jobMarkSeen(deps: Pick<CoreDeps, 'jobs'>) {
  return defineCommand({
    name: 'job.markSeen',
    input: jobMarkSeenInput,
    projectId: (input) => input.projectId,
    run(ctx, input) {
      const rows = input.jobIds.map((id) => requireJob(ctx.project, id))
      if (rows.some((r) => r.status !== 'succeeded')) {
        throw wrongState('Only a job that succeeded can be marked as seen.')
      }
      deps.jobs.markSeen(
        ctx,
        rows.map((r) => r.id),
      )
      return { data: { jobIds: input.jobIds } }
    },
  })
}
