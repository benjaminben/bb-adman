// Reads shared by the slice C queries (SPEC 4.3). A query never writes to a project.
import type Database from 'better-sqlite3'
import type { z } from 'zod'
import { readWireRow, readWireRows } from '../db/rows'
import type { ProjectHandle } from '../db/project-file'
import type { CoreDeps } from '../core-deps'
import { AppError } from '../../shared/schemas/result'
import type { CampaignRow } from '../../shared/schemas/rows/campaign'
import type { DirectionRow } from '../../shared/schemas/rows/direction'
import type { JobMarks } from '../../shared/schemas/queries/campaign'

// Validates the input and finds the open project, as the query runner rules (SPEC 4.3).
export function openFor<T extends { projectId: string }>(
  deps: Pick<CoreDeps, 'projects'>,
  schema: z.ZodType<T>,
  raw: unknown,
): { input: T; project: ProjectHandle } {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) throw new AppError('INVALID_INPUT', 'Some values are not valid.')
  return { input: parsed.data, project: deps.projects.requireOpen(parsed.data.projectId) }
}

export function requireCampaign(db: Database.Database, campaignId: string): CampaignRow {
  const row = readWireRow(db, 'campaign', { id: campaignId }) as CampaignRow | null
  if (!row) throw new AppError('NOT_FOUND', 'That campaign is not in this project.')
  return row
}

export function directionsOf(db: Database.Database, campaignId: string): DirectionRow[] {
  return (readWireRows(db, 'direction') as DirectionRow[])
    .filter((d) => d.campaignId === campaignId)
    .sort((a, b) => a.sort - b.sort || (a.id < b.id ? -1 : 1))
}

// SPEC 4.3 [1.8] job marks, for one column (campaign_id or variant_id) and its value.
export function jobMarks(
  db: Database.Database,
  column: 'campaign_id' | 'variant_id',
  id: string,
): JobMarks {
  const has = (where: string) =>
    db.prepare(`SELECT 1 FROM job WHERE "${column}" = ? AND ${where} LIMIT 1`).get(id) !== undefined
  return {
    jobRunning: has("status IN ('queued','running')"),
    resultUnseen: has("status = 'succeeded' AND seen_at IS NULL"),
  }
}
