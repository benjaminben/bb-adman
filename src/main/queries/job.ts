// The job query domain (SPEC 12, 4.3; SPEC 14 slice D). job.list: wire rows, newest first.
// job.get (MCP-D): one wire row, or NOT_FOUND.
// error_detail is not in a wire row (SPEC 3.3 [1.9]).
import type { CoreDeps } from '@/main/core-deps'
import type { QueryFn } from './types'
import { readWireRow, readWireRows } from '@/main/db/rows'
import {
  jobGetInput,
  jobListInput,
  type JobList,
  type JobListInput,
} from '@/shared/schemas/queries/job'
import type { JobRow } from '@/shared/schemas/rows/job'
import { AppError } from '@/shared/schemas/result'

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

export function jobGet(deps: Pick<CoreDeps, 'projects'>): QueryFn {
  return (raw): JobRow => {
    const parsed = jobGetInput.safeParse(raw)
    if (!parsed.success) throw new AppError('INVALID_INPUT', 'Some values are not valid.')
    const project = deps.projects.requireOpen(parsed.data.projectId)
    const row = readWireRow(project.db, 'job', { id: parsed.data.jobId }) as JobRow | null
    if (!row) throw new AppError('NOT_FOUND', 'That job was not found.')
    return row
  }
}

export function jobQueries(deps: CoreDeps): Record<string, QueryFn> {
  return { 'job.get': jobGet(deps), 'job.list': jobList(deps) }
}
