// LP-11: a project file may come from anyone, so before the app writes to it, it reads the
// file's layout (sqlite_master and SQLite's own pragmas, read only) and refuses any object
// the app's migrations do not make at the file's schema version. The allowed layout is
// found by running the same migrations on an empty in-memory database, so a new migration
// needs no edit here. A refusal is the fixed not-a-project sentence: nothing from the file
// goes into the error.
import Database from 'better-sqlite3'
import type { Migration } from './bundled-migrations'
import { notAProject, readSchemaVersion } from './meta'
import { AppError } from '@/shared/schemas/result'

type SchemaRow = { type: string; name: string; tbl_name: string; sql: string | null }

const TABLE_SQL = /^CREATE\s+TABLE\s/i
const INDEX_SQL = /^CREATE\s+(UNIQUE\s+)?INDEX\s/i

function schemaRows(db: Database.Database): SchemaRow[] {
  return db.prepare('SELECT type, name, tbl_name, sql FROM sqlite_master').all() as SchemaRow[]
}

// Only ordinary tables and indexes. This refuses triggers, views and virtual tables, and a
// row whose SQL is another kind of statement than its type says.
function plainObject(row: SchemaRow): boolean {
  if (row.type === 'table') return row.sql !== null && TABLE_SQL.test(row.sql)
  if (row.type !== 'index') return false
  if (row.sql === null) return row.name.startsWith('sqlite_autoindex_')
  return INDEX_SQL.test(row.sql)
}

function all(db: Database.Database, pragma: string, arg: string): unknown[] {
  return db.prepare(`SELECT * FROM pragma_${pragma}(?)`).all(arg)
}

// What SQLite itself makes of one object: a table's columns (generated ones too), primary
// key and foreign keys; an index's table, uniqueness, partial flag and key parts (an
// expression part has no column name).
function shape(db: Database.Database, row: SchemaRow): string {
  if (row.type === 'table') {
    return JSON.stringify([
      'table',
      all(db, 'table_xinfo', row.name),
      all(db, 'foreign_key_list', row.name),
    ])
  }
  const entry = (
    all(db, 'index_list', row.tbl_name) as Array<{ name: string; unique: number; partial: number }>
  ).find((i) => i.name === row.name)
  return JSON.stringify([
    'index',
    row.tbl_name,
    entry ? [entry.unique, entry.partial] : null,
    all(db, 'index_xinfo', row.name),
  ])
}

function layoutOf(db: Database.Database): Map<string, string> {
  const layout = new Map<string, string>()
  for (const row of schemaRows(db)) {
    if (layout.has(row.name)) throw notAProject()
    layout.set(row.name, shape(db, row))
  }
  return layout
}

function layoutAfter(migrations: Migration[]): Map<string, string> {
  const mem = new Database(':memory:')
  try {
    mem.pragma('trusted_schema = OFF')
    for (const migration of migrations) {
      for (const statement of migration.statements) mem.exec(statement)
    }
    return layoutOf(mem)
  } finally {
    mem.close()
  }
}

// Rule for an older file: every object in it must be one the first `version` migrations
// make, with the same shape. A missing object is not refused here. A file newer than the
// app is left to the newer-version refusal that follows, before any write.
export function checkLayout(db: Database.Database, migrations: Migration[]): void {
  try {
    if (!schemaRows(db).every(plainObject)) throw notAProject()
    const version = readSchemaVersion(db)
    if (version > migrations.length) return
    const allowed = layoutAfter(migrations.slice(0, version))
    for (const [name, found] of layoutOf(db)) {
      if (allowed.get(name) !== found) throw notAProject()
    }
  } catch (e) {
    if (e instanceof AppError) throw e
    throw notAProject()
  }
}
