import type Database from 'better-sqlite3'
import { projectMetaSchema, type ProjectMeta } from '../../shared/schemas/project'
import { storedProjectName } from '../../shared/schemas/project-name'
import { AppError } from '../../shared/schemas/result'

const KEYS: Record<keyof ProjectMeta, string> = {
  projectId: 'project_id',
  name: 'name',
  schemaVersion: 'schema_version',
  createdAppVersion: 'created_app_version',
  assetsDirRel: 'assets_dir_rel',
  assetsDirAbs: 'assets_dir_abs',
  createdAt: 'created_at',
}

export const NOT_A_PROJECT = 'This file is not an Adman project, or it is damaged.'

export function notAProject(): AppError {
  return new AppError('INVALID_INPUT', NOT_A_PROJECT, { reason: 'not_a_project' })
}

export function hasMetaTable(db: Database.Database): boolean {
  return (
    db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'project_meta'")
      .get() !== undefined
  )
}

export function readSchemaVersion(db: Database.Database): number {
  if (!hasMetaTable(db)) throw notAProject()
  const row = db.prepare("SELECT value FROM project_meta WHERE key = 'schema_version'").get() as
    { value: string } | undefined
  // SPEC 14 [1.34] V4: digits only, so '-1', '' or '1e0' cannot pick which migrations run.
  if (row === undefined || !/^[0-9]{1,9}$/.test(row.value)) throw notAProject()
  return Number(row.value)
}

// SPEC 14 [1.32] U11: the stored name alone, checked before an older file is backed up or
// migrated. project_meta is a key and value table in every schema version.
export function readStoredName(db: Database.Database): string {
  if (!hasMetaTable(db)) throw notAProject()
  const row = db.prepare("SELECT value FROM project_meta WHERE key = 'name'").get() as
    { value: string } | undefined
  const parsed = storedProjectName.safeParse(row?.value)
  if (!parsed.success) throw notAProject()
  return parsed.data
}

export function writeMeta(db: Database.Database, meta: Partial<ProjectMeta>): void {
  const upsert = db.prepare(
    'INSERT INTO project_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  )
  for (const [field, value] of Object.entries(meta)) {
    upsert.run(KEYS[field as keyof ProjectMeta], String(value))
  }
}

export function readMeta(db: Database.Database): ProjectMeta {
  const rows = db.prepare('SELECT key, value FROM project_meta').all() as Array<{
    key: string
    value: string
  }>
  const byKey = new Map(rows.map((r) => [r.key, r.value]))
  const raw = Object.fromEntries(
    Object.entries(KEYS).map(([field, key]) => [field, byKey.get(key)]),
  )
  const parsed = projectMetaSchema.safeParse({ ...raw, schemaVersion: Number(raw.schemaVersion) })
  if (!parsed.success) throw notAProject()
  return parsed.data
}
