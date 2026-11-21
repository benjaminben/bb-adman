// Shared by the job commands (SPEC 4.1, 4.2): the job row by ID, and the job_wrong_state
// refusal.
import type { ProjectHandle } from '../../db/project-file'
import { readWireRow } from '../../db/rows'
import type { JobRow } from '../../../shared/schemas/rows/job'
import { AppError } from '../../../shared/schemas/result'

export function requireJob(project: ProjectHandle, jobId: string): JobRow {
  const row = readWireRow(project.db, 'job', { id: jobId }) as JobRow | null
  if (!row) throw new AppError('NOT_FOUND', 'That job is not in this project.', { jobId })
  return row
}

export function wrongState(message: string): AppError {
  return new AppError('RULE_VIOLATION', message, { reason: 'job_wrong_state' })
}
