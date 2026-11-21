// The runner's reads and writes of `job` rows (SPEC 3.3, 3.6 "Jobs"). The runner is the only
// writer of job rows. Rows are read through rows.ts; written with SQL on the project file.
// `request` and `result` are JSON columns. rows.ts holds no write functions (SPEC 14 [1.25]),
// so this file builds their stored text, and is the only file in src/main/jobs/ that does.
import type { ProjectHandle } from '../db/project-file'
import { job } from '../db/schema'
import { readWireRow } from '../db/rows'
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
}

const COLUMNS: Record<keyof JobChange, string> = {
  status: 'status',
  progress: 'progress',
  result: 'result',
  errorKind: 'error_kind',
  errorReason: 'error_reason',
  errorDetail: 'error_detail',
}

function storedJson(value: unknown): string | null {
  return value === undefined || value === null ? null : JSON.stringify(value)
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
      request: storedJson(req.request) ?? 'null',
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
    values.push(field === 'result' ? storedJson(value) : value)
  }
  sets.push('"updated_at" = ?')
  h.db.prepare(`UPDATE "job" SET ${sets.join(', ')} WHERE "id" = ?`).run(...values, now, id)
}

export function addPaidCall(h: ProjectHandle, id: string, now: string): void {
  h.db
    .prepare('UPDATE "job" SET "paid_calls" = "paid_calls" + 1, "updated_at" = ? WHERE "id" = ?')
    .run(now, id)
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
