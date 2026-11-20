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
    provider: text('provider'),
    model: text('model'),
    request: text('request').notNull(),
    remoteJobId: text('remote_job_id'),
    result: text('result'),
    errorKind: text('error_kind'),
    errorDetail: text('error_detail'),
    progress: real('progress'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    check(
      'job_kind',
      sql`${t.kind} IN ('brief_extraction','image_generation','generative_fill','layout_proposal','copy_options','translation','video_generation','export','publish')`,
    ),
    check('job_status', sql`${t.status} IN ('queued','running','succeeded','failed','cancelled')`),
    check(
      'job_error_kind',
      sql`${t.errorKind} IN ('bad_key','quota','refused','timeout','offline','other')`,
    ),
    index('job_status').on(t.status, t.updatedAt),
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
