// SPEC 4.4: the only code that turns a stored row into a wire row. Field names in
// camelCase, flag columns as booleans, JSON columns parsed, empty columns as null.
import type Database from 'better-sqlite3'
import { getTableColumns } from 'drizzle-orm'
import type { SQLiteTable } from 'drizzle-orm/sqlite-core'
import * as schema from './schema'
import type { ActivityLog } from '../log/activity-log'
import { ROW_KEYS, rowKey, type TableName } from '../../shared/schemas/rows/keys'
import { ROW_SCHEMAS } from '../../shared/schemas/rows'
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

// SPEC 3.3 JSON columns, by table. Each value is checked with its table's wire row schema.
const JSON_COLUMNS: Partial<Record<TableName, readonly string[]>> = {
  campaign: ['languages', 'sizes', 'brief'],
  rule_set: ['requiredAssetIds', 'palette', 'requiredWords', 'prohibitedWords'],
  layer: ['overrides', 'style', 'geometry', 'source', 'timing', 'animation', 'revs', 'syncedRevs'],
  background_clip: ['placement'],
  job: ['request', 'result'],
  report: ['body'],
  variant_check: ['results'],
}

// SPEC 4.4: stored columns that never leave the main process, by table (SQL names).
const MAIN_ONLY_COLUMNS: Partial<Record<TableName, readonly string[]>> = {
  job: ['error_detail'],
}

function columnsOf(table: TableName): Array<[field: string, sqlName: string]> {
  return Object.entries(getTableColumns(TABLES[table])).map(([field, c]) => [field, c.name])
}

function wireColumnsOf(table: TableName): Array<[field: string, sqlName: string]> {
  const mainOnly = new Set(MAIN_ONLY_COLUMNS[table] ?? [])
  return columnsOf(table).filter(([, sqlName]) => !mainOnly.has(sqlName))
}

function toWire(table: TableName, stored: Record<string, unknown>): WireRow {
  const json = new Set(JSON_COLUMNS[table] ?? [])
  const row: WireRow = {}
  for (const [field, sqlName] of wireColumnsOf(table)) {
    const value = stored[sqlName] ?? null
    if (value === null) row[field] = null
    else if (FLAGS.has(field)) row[field] = value === 1
    else if (json.has(field)) row[field] = JSON.parse(String(value)) as unknown
    else row[field] = value
  }
  return checked(table, row)
}

// SPEC 4.4: a row that fails its table's schema throws. The error names the table and the
// fields, never a value.
function checked(table: TableName, row: WireRow): WireRow {
  const schema = ROW_SCHEMAS[table]
  if (!schema) return row
  const parsed = schema.safeParse(row)
  if (parsed.success) return parsed.data
  const fields = parsed.error.issues.map((i) => i.path.join('.')).join(', ')
  throw new Error(`${table} row does not match its schema: ${fields}`)
}

function keyOf(table: TableName, stored: Record<string, unknown>): string {
  const names = new Map(columnsOf(table))
  const key: Record<string, unknown> = {}
  for (const field of ROW_KEYS[table]) key[field] = stored[names.get(field) ?? field]
  return rowKey(table, key)
}

function selectList(table: TableName): string {
  return wireColumnsOf(table)
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

// Every row of a table. A row that cannot be read is left out and logged by table and key,
// with no values: it means the file was damaged or made by hand (SPEC 4.4, 8.1).
export function readWireRows(
  db: Database.Database,
  table: TableName,
  log?: ActivityLog,
): WireRow[] {
  const stored = db.prepare(`SELECT ${selectList(table)} FROM "${table}"`).all() as Array<
    Record<string, unknown>
  >
  const rows: WireRow[] = []
  for (const r of stored) {
    try {
      rows.push(toWire(table, r))
    } catch {
      log?.write({
        level: 'error',
        event: 'query',
        name: 'rows.read',
        actor: 'system',
        ok: false,
        message: 'A stored row could not be read and was left out.',
        context: { table, key: keyOf(table, r) },
      })
    }
  }
  return rows
}

// SPEC 4.4 [1.38]: the text to store for a JSON column, or null for null. Writes nothing.
export function storedJson(table: TableName, field: string, value: unknown): string | null {
  if (!(JSON_COLUMNS[table] ?? []).includes(field)) {
    throw new Error(`${table}.${field} is not a JSON column`)
  }
  if (value === null || value === undefined) return null
  const text: unknown = JSON.stringify(value)
  if (typeof text !== 'string') throw new Error(`${table}.${field} has no JSON text`)
  return text
}

// SPEC 3.3, 4.4: the raw provider text of a failed job, for main-process code only (the log
// and the Phase 8 report). Null when the job is not there or has no detail.
export function readJobErrorDetail(db: Database.Database, jobId: string): string | null {
  const stored = db.prepare('SELECT "error_detail" FROM "job" WHERE "id" = ?').get(jobId) as
    { error_detail: string | null } | undefined
  return stored?.error_detail ?? null
}
