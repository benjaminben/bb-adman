import { sql } from 'drizzle-orm'
import { sqliteTable, text, integer, index, check, primaryKey } from 'drizzle-orm/sqlite-core'

// SPEC 3.3 project_meta. Keys: project_id, name, schema_version, created_app_version,
// assets_dir_rel, assets_dir_abs, created_at.
export const projectMeta = sqliteTable('project_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})

export const subject = sqliteTable('subject', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  createdAt: text('created_at').notNull(),
})

export const asset = sqliteTable(
  'asset',
  {
    id: text('id').primaryKey(),
    library: text('library').notNull(),
    kind: text('kind').notNull(),
    origin: text('origin').notNull(),
    storage: text('storage').notNull(),
    subjectId: text('subject_id').references(() => subject.id, { onDelete: 'set null' }),
    displayName: text('display_name').notNull(),
    absPath: text('abs_path').notNull(),
    relPath: text('rel_path').notNull(),
    mime: text('mime').notNull(),
    byteSize: integer('byte_size').notNull(),
    mtimeMs: integer('mtime_ms').notNull(),
    contentHash: text('content_hash').notNull(),
    width: integer('width'),
    height: integer('height'),
    durationMs: integer('duration_ms'),
    fontFamily: text('font_family'),
    fontPublishAllowed: integer('font_publish_allowed').notNull().default(0),
    genRunId: text('gen_run_id'),
    genProvider: text('gen_provider'),
    genModel: text('gen_model'),
    genPrompt: text('gen_prompt'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    check('asset_library', sql`${t.library} IN ('reference','asset')`),
    check('asset_kind', sql`${t.kind} IN ('image','video','font','text')`),
    check('asset_origin', sql`${t.origin} IN ('imported','generated')`),
    check('asset_storage', sql`${t.storage} IN ('linked','managed')`),
    index('asset_subject').on(t.subjectId),
    index('asset_content_hash').on(t.contentHash),
    index('asset_library_kind').on(t.library, t.kind),
  ],
)

export const campaign = sqliteTable(
  'campaign',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    region: text('region').notNull(),
    audience: text('audience').notNull(),
    message: text('message').notNull(),
    offer: text('offer'),
    callToAction: text('call_to_action'),
    tone: text('tone'),
    primaryLanguage: text('primary_language').notNull(),
    languages: text('languages').notNull(),
    sizes: text('sizes').notNull(),
    templateId: text('template_id').notNull(),
    brief: text('brief').notNull(),
    createdBy: text('created_by').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [check('campaign_created_by', sql`${t.createdBy} IN ('user','agent')`)],
)

export const campaignSubject = sqliteTable(
  'campaign_subject',
  {
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaign.id, { onDelete: 'cascade' }),
    subjectId: text('subject_id')
      .notNull()
      .references(() => subject.id),
  },
  (t) => [primaryKey({ columns: [t.campaignId, t.subjectId] })],
)

export const ruleSet = sqliteTable('rule_set', {
  campaignId: text('campaign_id')
    .primaryKey()
    .references(() => campaign.id, { onDelete: 'cascade' }),
  requiredAssetIds: text('required_asset_ids').notNull().default('[]'),
  palette: text('palette').notNull().default('[]'),
  requiredWords: text('required_words').notNull().default('{}'),
  prohibitedWords: text('prohibited_words').notNull().default('{}'),
})

export const direction = sqliteTable('direction', {
  id: text('id').primaryKey(),
  campaignId: text('campaign_id')
    .notNull()
    .references(() => campaign.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  masterVariantId: text('master_variant_id').notNull(),
  sort: integer('sort').notNull(),
})
