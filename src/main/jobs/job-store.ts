// The runner's reads and writes of `job` rows (SPEC 3.3, 3.6 "Jobs"). The runner is the only
// writer of job rows. Rows are read through rows.ts; written with SQL on the project file.
// `request` and `result` are JSON columns: their stored text comes from storedJson in rows.ts
// (SPEC 4.4 [1.38]), which writes nothing.
import type { ProjectHandle } from '../db/project-file'
import { job } from '../db/schema'
import { readWireRow, storedJson } from '../db/rows'
import type { EnqueueRequest } from './types'
import type { JobStatus } from '../../shared/config/job-kinds'
import type { JobRow } from '../../shared/schemas/rows/job'
import type { ProviderErrorKind, ProviderErrorReason } from '../../shared/schemas/queries/app'

export type JobChange = {
  status?: JobStatus
  progress?: number
  result?: unknown
  errorKind?: ProviderErrorKind
  errorReason?: ProviderErrorReason | null
  errorDetail?: string
  remoteJobId?: string
}

const COLUMNS: Record<keyof JobChange, string> = {
  remoteJobId: 'remote_job_id',
  status: 'status',
  progress: 'progress',
  result: 'result',
  errorKind: 'error_kind',
  errorReason: 'error_reason',
  errorDetail: 'error_detail',
}

export function insertQueued(h: ProjectHandle, id: string, req: EnqueueRequest, now: string) {
  h.orm
    .insert(job)
    .values({
      id,
      kind: req.kind,
      status: 'queued',
      campaignId: req.campaignId,
      variantId: req.variantId,
      layerId: req.layerId,
      slot: req.slot,
      provider: req.provider,
      model: req.model,
      request: storedJson('job', 'request', req.request) ?? 'null',
      startedBy: req.startedBy,
      createdAt: now,
      updatedAt: now,
    })
    .run()
}

export function updateJob(h: ProjectHandle, id: string, change: JobChange, now: string): void {
  const sets: string[] = []
  const values: unknown[] = []
  for (const [field, value] of Object.entries(change) as Array<[keyof JobChange, unknown]>) {
    sets.push(`"${COLUMNS[field]}" = ?`)
    values.push(field === 'result' ? storedJson('job', 'result', value) : value)
  }
  sets.push('"updated_at" = ?')
  h.db.prepare(`UPDATE "job" SET ${sets.join(', ')} WHERE "id" = ?`).run(...values, now, id)
}

export function addPaidCall(h: ProjectHandle, id: string, now: string): void {
  h.db
    .prepare('UPDATE "job" SET "paid_calls" = "paid_calls" + 1, "updated_at" = ? WHERE "id" = ?')
    .run(now, id)
}

// SPEC 3.6 "Jobs" item 3 [1.38]: true when the row was marked now.
export function markSeenRow(h: ProjectHandle, id: string, now: string): boolean {
  const r = h.db
    .prepare(
      `UPDATE "job" SET "seen_at" = ?, "updated_at" = ?
       WHERE "id" = ? AND "seen_at" IS NULL AND "status" = 'succeeded'`,
    )
    .run(now, now, id)
  return r.changes > 0
}

export function readJob(h: ProjectHandle, id: string): JobRow | null {
  return readWireRow(h.db, 'job', { id }) as JobRow | null
}

export type ActiveJob = { id: string; status: 'queued' | 'running'; provider: string | null }

// Queued and running jobs, oldest first.
export function activeJobs(h: ProjectHandle): ActiveJob[] {
  return h.db
    .prepare(
      `SELECT "id", "status", "provider" FROM "job" WHERE "status" IN ('queued', 'running')
       ORDER BY "created_at", "id"`,
    )
    .all() as ActiveJob[]
}
