// The job query domain (SPEC 12, 4.3; SPEC 14 slice D). job.list: wire rows, newest first.
// error_detail is not in a wire row (SPEC 3.3 [1.9]). The map stays empty until the test
// that pins it empty is changed by an approved edit.
import type { CoreDeps } from '../core-deps'
import type { QueryFn } from './types'
import { readWireRows } from '../db/rows'
import { jobListInput, type JobList, type JobListInput } from '../../shared/schemas/queries/job'
import type { JobRow } from '../../shared/schemas/rows/job'
import { AppError } from '../../shared/schemas/result'

function inState(r: JobRow, state: JobListInput['state']): boolean {
  if (state === 'active') return r.status === 'queued' || r.status === 'running'
  if (state === 'unseen') return r.status === 'succeeded' && r.seenAt === null
  if (state === 'failed') return r.status === 'failed'
  return true
}

const newestFirst = (a: JobRow, b: JobRow) =>
  a.createdAt === b.createdAt ? (a.id < b.id ? 1 : -1) : a.createdAt < b.createdAt ? 1 : -1

export function jobList(deps: Pick<CoreDeps, 'projects' | 'log'>): QueryFn {
  return (raw): JobList => {
    const parsed = jobListInput.safeParse(raw)
    if (!parsed.success) throw new AppError('INVALID_INPUT', 'Some values are not valid.')
    const { projectId, campaignId, variantId, layerId, state, limit } = parsed.data
    const project = deps.projects.requireOpen(projectId)
    const rows = (readWireRows(project.db, 'job', deps.log) as JobRow[]).filter(
      (r) =>
        (!campaignId || r.campaignId === campaignId) &&
        (!variantId || r.variantId === variantId) &&
        (!layerId || r.layerId === layerId) &&
        inState(r, state),
    )
    return rows.sort(newestFirst).slice(0, limit)
  }
}

export function jobQueries(_deps: CoreDeps): Record<string, QueryFn> {
  return {}
}
