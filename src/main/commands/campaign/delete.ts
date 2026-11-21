// campaign.delete (SPEC 4.2; FR-197, D-023). Not undoable; an agent is asked every time
// (agent policy ask). The cascade of SPEC 3.3 removes the campaign's subjects list, rule
// set, directions, variants with their layers, subjects, clips and checks, and its reports.
// Each removed row is named, so the window hears of all of them (SPEC 4.4).
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { defineCommand, type ProjectContext } from '@/main/commands/types'
import { campaign } from '@/main/db/schema'
import { readWireRow } from '@/main/db/rows'
import { campaignNotFound } from './rule-set-values'
import { AppError } from '@/shared/schemas/result'
import { campaignDeleteInput } from '@/shared/schemas/commands/campaign-edit'
import type { TableName } from '@/shared/schemas/rows/keys'

const VARIANTS = `SELECT v.id FROM variant v JOIN direction d ON d.id = v.direction_id
  WHERE d.campaign_id = ?`

// Each table's key fields, as the wire names, for the rows the cascade removes.
const REMOVED: Array<[TableName, string]> = [
  [
    'campaign_subject',
    'SELECT campaign_id AS campaignId, subject_id AS subjectId FROM campaign_subject WHERE campaign_id = ?',
  ],
  ['rule_set', 'SELECT campaign_id AS campaignId FROM rule_set WHERE campaign_id = ?'],
  ['direction', 'SELECT id FROM direction WHERE campaign_id = ?'],
  ['variant', VARIANTS],
  [
    'variant_subject',
    `SELECT variant_id AS variantId, subject_id AS subjectId FROM variant_subject WHERE variant_id IN (${VARIANTS})`,
  ],
  ['layer', `SELECT id FROM layer WHERE variant_id IN (${VARIANTS})`],
  ['background_clip', `SELECT id FROM background_clip WHERE variant_id IN (${VARIANTS})`],
  [
    'variant_check',
    `SELECT variant_id AS variantId FROM variant_check WHERE variant_id IN (${VARIANTS})`,
  ],
  ['report', 'SELECT id FROM report WHERE campaign_id = ?'],
]

const KeyRow = z.record(z.string(), z.string())

// SPEC 4.2 [1.42], C-R4: a queued or running job for the campaign or one of its variants
// stops the delete, so no paid run ends with a picture for a variant that is gone.
function refuseWhileJobsRun(ctx: ProjectContext, campaignId: string): void {
  const { n } = ctx.project.db
    .prepare<[string, string], { n: number }>(
      `SELECT COUNT(*) AS n FROM job WHERE status IN ('queued','running')
       AND (campaign_id = ? OR variant_id IN (${VARIANTS}))`,
    )
    .get(campaignId, campaignId) ?? { n: 0 }
  if (n > 0) {
    throw new AppError(
      'RULE_VIOLATION',
      'Work is still running in this campaign. Stop it, or wait for it to finish.',
      { reason: 'jobs_running', count: n },
    )
  }
}

function touchRemoved(ctx: ProjectContext, campaignId: string): void {
  for (const [table, sql] of REMOVED) {
    for (const row of ctx.project.db.prepare(sql).all(campaignId)) {
      ctx.changes.touch(table, KeyRow.parse(row))
    }
  }
}

export function campaignDelete() {
  return defineCommand({
    name: 'campaign.delete',
    input: campaignDeleteInput,
    projectId: (input) => input.projectId,
    run(ctx, input) {
      if (!readWireRow(ctx.project.db, 'campaign', { id: input.campaignId })) {
        throw campaignNotFound()
      }
      refuseWhileJobsRun(ctx, input.campaignId)
      ctx.changes.touch('campaign', { id: input.campaignId })
      touchRemoved(ctx, input.campaignId)
      ctx.project.orm.delete(campaign).where(eq(campaign.id, input.campaignId)).run()
      return { data: { campaignId: input.campaignId }, log: { campaignId: input.campaignId } }
    },
  })
}
