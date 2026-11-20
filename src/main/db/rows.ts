// SPEC 4.4: the only code that turns a stored row into a wire row. Field names in
// camelCase, flag columns as booleans, JSON columns parsed, empty columns as null.
import type Database from 'better-sqlite3'
import { getTableColumns } from 'drizzle-orm'
import type { SQLiteTable } from 'drizzle-orm/sqlite-core'
import * as schema from './schema'
import { ROW_KEYS, type TableName } from '../../shared/schemas/rows/keys'
import type { WireRow } from '../../shared/schemas/events'

const TABLES: Record<TableName, SQLiteTable> = {
  project_meta: schema.projectMeta,
  subject: schema.subject,
  asset: schema.asset,
  campaign: schema.campaign,
  campaign_subject: schema.campaignSubject,
  rule_set: schema.ruleSet,
  direction: schema.direction,
  variant: schema.variant,
  variant_subject: schema.variantSubject,
  layer: schema.layer,
  background_clip: schema.backgroundClip,
  job: schema.job,
  report: schema.report,
  variant_check: schema.variantCheck,
}

const FLAGS = new Set([
  'fontPublishAllowed',
  'durationOverridden',
  'visible',
  'locked',
  'linked',
  'overflow',
])

// SPEC 3.3 JSON columns, by table. The Zod check of each value arrives with the wire row
// schemas (Phase 2 step 0 and later phases).
const JSON_COLUMNS: Partial<Record<TableName, readonly string[]>> = {
  campaign: ['languages', 'sizes', 'brief'],
  rule_set: ['requiredAssetIds', 'palette', 'requiredWords', 'prohibitedWords'],
  layer: ['overrides', 'style', 'geometry', 'source', 'timing', 'animation', 'revs', 'syncedRevs'],
  background_clip: ['placement'],
  job: ['request', 'result'],
  report: ['body'],
  variant_check: ['results'],
}

function columnsOf(table: TableName): Array<[field: string, sqlName: string]> {
  return Object.entries(getTableColumns(TABLES[table])).map(([field, c]) => [field, c.name])
}

function toWire(table: TableName, stored: Record<string, unknown>): WireRow {
  const json = new Set(JSON_COLUMNS[table] ?? [])
  const row: WireRow = {}
  for (const [field, sqlName] of columnsOf(table)) {
    const value = stored[sqlName] ?? null
    if (value === null) row[field] = null
    else if (FLAGS.has(field)) row[field] = value === 1
    else if (json.has(field)) row[field] = JSON.parse(String(value)) as unknown
    else row[field] = value
  }
  return row
}

function selectList(table: TableName): string {
  return columnsOf(table)
    .map(([, sqlName]) => `"${sqlName}"`)
    .join(', ')
}

// The row named by its key fields, or null when it is not there.
export function readWireRow(
  db: Database.Database,
  table: TableName,
  key: Record<string, unknown>,
): WireRow | null {
  const names = new Map(columnsOf(table))
  const fields: readonly string[] = ROW_KEYS[table]
  const where = fields.map((f) => `"${names.get(f) ?? f}" = ?`).join(' AND ')
  const stored = db
    .prepare(`SELECT ${selectList(table)} FROM "${table}" WHERE ${where}`)
    .get(...fields.map((f) => key[f])) as Record<string, unknown> | undefined
  return stored ? toWire(table, stored) : null
}

export function readWireRows(db: Database.Database, table: TableName): WireRow[] {
  const stored = db.prepare(`SELECT ${selectList(table)} FROM "${table}"`).all() as Array<
    Record<string, unknown>
  >
  return stored.map((r) => toWire(table, r))
}
