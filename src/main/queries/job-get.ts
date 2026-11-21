// job.get (MCP-D; SPEC api-queries-events): one wire row of an open project, or NOT_FOUND.
// Open to both actors. The MCP tool get_job never passes the row on: it cuts it down with
// agentJobView (src/main/mcp/tools/agent-job-view.ts). error_detail is not in a wire row.
import type { CoreDeps } from '@/main/core-deps'
import type { QueryFn } from './types'
import { readWireRow } from '@/main/db/rows'
import { jobGetInput } from '@/shared/schemas/queries/job'
import type { JobRow } from '@/shared/schemas/rows/job'
import { AppError } from '@/shared/schemas/result'

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

export function jobGetQueries(deps: CoreDeps): Record<string, QueryFn> {
  return { 'job.get': jobGet(deps) }
}
