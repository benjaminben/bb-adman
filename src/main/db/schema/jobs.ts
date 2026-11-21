import { sql } from 'drizzle-orm'
import { sqliteTable, text, integer, real, index, check } from 'drizzle-orm/sqlite-core'
import { campaign } from './project'
import { variant } from './variant'

export const job = sqliteTable(
  'job',
  {
    id: text('id').primaryKey(),
    kind: text('kind').notNull(),
    status: text('status').notNull(),
    campaignId: text('campaign_id'),
    variantId: text('variant_id'),
    // [1.8] migration 0001: the layer or template slot the job is for (SPEC 3.3).
    layerId: text('layer_id'),
    slot: text('slot'),
    provider: text('provider'),
    model: text('model'),
    request: text('request').notNull(),
    remoteJobId: text('remote_job_id'),
    result: text('result'),
    errorKind: text('error_kind'),
    errorDetail: text('error_detail'),
    progress: real('progress'),
    // [1.8] migration 0001: provider calls sent that may be charged, and when the result was seen.
    paidCalls: integer('paid_calls').notNull().default(0),
    seenAt: text('seen_at'),
    // [1.35] migration 0002: who started the run, and the reason a failed run gives (SPEC 6.11.1).
    startedBy: text('started_by').notNull().default('user'),
    errorReason: text('error_reason'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    check(
      'job_kind',
      sql`${t.kind} IN ('brief_extraction','image_generation','generative_fill','layout_proposal','copy_options','translation','video_generation','export','publish','cutout')`,
    ),
    check('job_status', sql`${t.status} IN ('queued','running','succeeded','failed','cancelled')`),
    check(
      'job_error_kind',
      sql`${t.errorKind} IN ('bad_key','quota','refused','timeout','offline','other')`,
    ),
    check('job_started_by', sql`${t.startedBy} IN ('user','agent')`),
    index('job_status').on(t.status, t.updatedAt),
    index('job_target').on(t.campaignId, t.variantId),
  ],
)

export const report = sqliteTable('report', {
  id: text('id').primaryKey(),
  campaignId: text('campaign_id')
    .notNull()
    .references(() => campaign.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull(),
  outputDir: text('output_dir').notNull(),
  body: text('body').notNull(),
})

export const variantCheck = sqliteTable(
  'variant_check',
  {
    variantId: text('variant_id')
      .primaryKey()
      .references(() => variant.id, { onDelete: 'cascade' }),
    checkedRev: integer('checked_rev').notNull(),
    ranAt: text('ran_at').notNull(),
    ranBy: text('ran_by').notNull(),
    results: text('results').notNull(),
  },
  (t) => [check('variant_check_ran_by', sql`${t.ranBy} IN ('user','agent','export')`)],
)
