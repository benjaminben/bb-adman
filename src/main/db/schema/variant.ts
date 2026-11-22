import { sql } from 'drizzle-orm'
import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
  unique,
  check,
  primaryKey,
} from 'drizzle-orm/sqlite-core'
import { direction, subject, asset } from './project'

export const variant = sqliteTable(
  'variant',
  {
    id: text('id').primaryKey(),
    directionId: text('direction_id')
      .notNull()
      .references(() => direction.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    sizeLabel: text('size_label').notNull(),
    language: text('language').notNull(),
    format: text('format').notNull(),
    durationMs: integer('duration_ms').notNull(),
    durationOverridden: integer('duration_overridden').notNull().default(0),
    rev: integer('rev').notNull().default(0),
    createdBy: text('created_by').notNull(),
    createdAt: text('created_at').notNull(),
    // [1.8] migration 0001: last time an agent changed the variant; null = never (FR-239).
    agentChangedAt: text('agent_changed_at'),
    // P7-2 migration 0005: the first clip has been made (OI-20); the sound of a video.
    firstClipMade: integer('first_clip_made').notNull().default(0),
    sound: text('sound').notNull().default('clips'),
    soundAssetId: text('sound_asset_id').references(() => asset.id),
  },
  (t) => [
    check('variant_format', sql`${t.format} IN ('image','video')`),
    check('variant_sound', sql`${t.sound} IN ('clips','file','none')`),
    check('variant_created_by', sql`${t.createdBy} IN ('user','agent')`),
    uniqueIndex('variant_grid').on(t.directionId, t.sizeLabel, t.language, t.format),
  ],
)

export const variantSubject = sqliteTable(
  'variant_subject',
  {
    variantId: text('variant_id')
      .notNull()
      .references(() => variant.id, { onDelete: 'cascade' }),
    subjectId: text('subject_id')
      .notNull()
      .references(() => subject.id),
  },
  (t) => [primaryKey({ columns: [t.variantId, t.subjectId] })],
)

export const layer = sqliteTable(
  'layer',
  {
    id: text('id').primaryKey(),
    variantId: text('variant_id')
      .notNull()
      .references(() => variant.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    type: text('type').notNull(),
    slot: text('slot'),
    name: text('name').notNull(),
    z: integer('z').notNull(),
    visible: integer('visible').notNull().default(1),
    locked: integer('locked').notNull().default(0),
    linked: integer('linked').notNull().default(0),
    overrides: text('overrides').notNull().default('[]'),
    copy: text('copy'),
    style: text('style').notNull(),
    geometry: text('geometry').notNull(),
    source: text('source'),
    timing: text('timing').notNull(),
    animation: text('animation').notNull(),
    revs: text('revs').notNull(),
    syncedRevs: text('synced_revs').notNull(),
    translationStatus: text('translation_status'),
    translationSource: text('translation_source'),
    overflow: integer('overflow').notNull().default(0),
  },
  (t) => [
    check('layer_type', sql`${t.type} IN ('background','image','text')`),
    check(
      'layer_translation_status',
      sql`${t.translationStatus} IN ('missing','proposed','approved')`,
    ),
    check('layer_translation_source', sql`${t.translationSource} IN ('ai','agent','user','brief')`),
    unique('layer_variant_key').on(t.variantId, t.key),
    index('layer_variant').on(t.variantId, t.z),
  ],
)

export const backgroundClip = sqliteTable(
  'background_clip',
  {
    id: text('id').primaryKey(),
    variantId: text('variant_id')
      .notNull()
      .references(() => variant.id, { onDelete: 'cascade' }),
    assetId: text('asset_id')
      .notNull()
      .references(() => asset.id),
    startMs: integer('start_ms').notNull(),
    inMs: integer('in_ms').notNull(),
    outMs: integer('out_ms').notNull(),
    placement: text('placement'),
    soundOn: integer('sound_on').notNull().default(1),
  },
  (t) => [index('clip_variant').on(t.variantId, t.startMs)],
)
