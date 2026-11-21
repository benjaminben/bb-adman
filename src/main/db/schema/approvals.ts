// The approvals side tables (spec/approvals.md "Local tables", migration 0004_approvals). Not
// wire rows: they are not in ROW_KEYS, TableName or ROW_SCHEMAS, and only
// src/main/approvals/local-store.ts reads or writes them.
import { sql } from 'drizzle-orm'
import { sqliteTable, text, integer, index, check, primaryKey } from 'drizzle-orm/sqlite-core'
import { campaign } from './project'
import { variant } from './variant'

export const approvalLink = sqliteTable(
  'approval_link',
  {
    campaignId: text('campaign_id')
      .primaryKey()
      .references(() => campaign.id, { onDelete: 'cascade' }),
    // 12 letters, as the service gave it.
    slug: text('slug').notNull(),
    state: text('state').notNull(),
    createdAt: text('created_at').notNull(),
    // The last successful "Update gallery".
    publishedAt: text('published_at'),
    // The last successful refresh.
    checkedAt: text('checked_at'),
    endedAt: text('ended_at'),
  },
  (t) => [check('approval_link_state', sql`${t.state} IN ('live','ended')`)],
)

// What the gallery shows now.
export const approvalVariant = sqliteTable(
  'approval_variant',
  {
    campaignId: text('campaign_id')
      .notNull()
      .references(() => approvalLink.campaignId, { onDelete: 'cascade' }),
    variantId: text('variant_id')
      .notNull()
      .references(() => variant.id, { onDelete: 'cascade' }),
    publishedRev: integer('published_rev').notNull(),
    // When its signed picture address runs out.
    expiresAt: text('expires_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.campaignId, t.variantId] })],
)

// The last list read from the service. variant_id has no reference: a sign-off outlives a
// deleted variant.
export const approvalSignoff = sqliteTable(
  'approval_signoff',
  {
    // The service's sign-off ID, 24 letters.
    id: text('id').primaryKey(),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => approvalLink.campaignId, { onDelete: 'cascade' }),
    variantId: text('variant_id').notNull(),
    version: integer('version').notNull(),
    email: text('email').notNull(),
    signedAt: text('signed_at').notNull(),
  },
  (t) => [index('approval_signoff_campaign').on(t.campaignId)],
)
