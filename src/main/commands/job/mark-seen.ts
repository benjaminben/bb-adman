// job.markSeen (SPEC 4.2 notes, 3.3; FR-218): sets seen_at on each named job that succeeded
// and has none. Marking twice is not an error. Bumps no rev.
import { defineCommand } from '../types'
import type { CoreDeps } from '../../core-deps'
import { requireJob, wrongState } from './find-job'
import { jobMarkSeenInput } from '../../../shared/schemas/commands/job'

export function jobMarkSeen(deps: Pick<CoreDeps, 'now'>) {
  return defineCommand({
    name: 'job.markSeen',
    input: jobMarkSeenInput,
    projectId: (input) => input.projectId,
    run(ctx, input) {
      const rows = input.jobIds.map((id) => requireJob(ctx.project, id))
      if (rows.some((r) => r.status !== 'succeeded')) {
        throw wrongState('Only a job that succeeded can be marked as seen.')
      }
      const now = deps.now().toISOString()
      const mark = ctx.project.db.prepare(
        'UPDATE "job" SET "seen_at" = ?, "updated_at" = ? WHERE "id" = ? AND "seen_at" IS NULL',
      )
      for (const r of rows) mark.run(now, now, r.id)
      return { data: { jobIds: input.jobIds } }
    },
  })
}
