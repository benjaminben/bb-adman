// Inserts job rows for the P4-2 query tests (spec/ai-jobs.md "The three queries"). Not a test
// file itself.
import type Database from 'better-sqlite3'

export type JobSeed = {
  id: string
  kind?: string
  status?: string
  campaignId?: string | null
  variantId?: string | null
  layerId?: string | null
  slot?: string | null
  provider?: string
  paidCalls?: number
  result?: unknown
  request?: string
  createdAt: string
}

export function insertJob(db: Database.Database, j: JobSeed): void {
  db.prepare(
    `INSERT INTO job (id, kind, status, campaign_id, variant_id, layer_id, slot, provider, model,
      request, result, paid_calls, started_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'm', ?, ?, ?, 'user', ?, ?)`,
  ).run(
    j.id,
    j.kind ?? 'image_generation',
    j.status ?? 'succeeded',
    j.campaignId ?? null,
    j.variantId ?? null,
    j.layerId ?? null,
    j.slot ?? null,
    j.provider ?? 'fake',
    j.request ?? '{}',
    j.result === undefined ? null : JSON.stringify(j.result),
    j.paidCalls ?? 0,
    j.createdAt,
    j.createdAt,
  )
}
