// job.activity (spec/ai-jobs.md "The three queries") [REQ: FR-152, FR-217]: every job of the
// project, newest first, with the names of where each belongs. An unreadable row is left out
// and logged, as job.list does.
import type Database from 'better-sqlite3'
import type { CoreDeps } from '@/main/core-deps'
import type { QueryFn } from './types'
import { readWireRows } from '@/main/db/rows'
import {
  jobActivityInput,
  type JobActivity,
  type JobPlace,
} from '@/shared/schemas/queries/activity'
import type { JobRow } from '@/shared/schemas/rows/job'
import { AppError } from '@/shared/schemas/result'

// Newest first; the ID breaks a tie so the order is the same on every call (as job.list).
export const newestFirst = (a: JobRow, b: JobRow) =>
  a.createdAt === b.createdAt ? (a.id < b.id ? 1 : -1) : a.createdAt < b.createdAt ? 1 : -1

type VariantNames = { title: string; size_label: string; language: string }

function placeOf(db: Database.Database, job: JobRow): JobPlace {
  const nameIn = (table: 'campaign' | 'layer', id: string | null): string | null => {
    if (id === null) return null
    const row = db.prepare(`SELECT name FROM ${table} WHERE id = ?`).get(id) as
      { name: string } | undefined
    return row?.name ?? null
  }
  const variant =
    job.variantId === null
      ? undefined
      : (db
          .prepare('SELECT title, size_label, language FROM variant WHERE id = ?')
          .get(job.variantId) as VariantNames | undefined)
  return {
    campaignName: nameIn('campaign', job.campaignId),
    variantLabel: variant ? `${variant.title} · ${variant.size_label} · ${variant.language}` : null,
    layerName: nameIn('layer', job.layerId),
  }
}

export function jobActivity(deps: Pick<CoreDeps, 'projects' | 'log'>): QueryFn {
  return (raw): JobActivity => {
    const parsed = jobActivityInput.safeParse(raw)
    if (!parsed.success) throw new AppError('INVALID_INPUT', 'Some values are not valid.')
    const { projectId, limit } = parsed.data
    const { db } = deps.projects.requireOpen(projectId)
    const jobs = (readWireRows(db, 'job', deps.log) as JobRow[]).sort(newestFirst)
    return jobs.slice(0, limit).map((job) => ({ job, place: placeOf(db, job) }))
  }
}

export function activityQueries(deps: CoreDeps): Record<string, QueryFn> {
  return { 'job.activity': jobActivity(deps) }
}
