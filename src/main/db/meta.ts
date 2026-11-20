import type Database from 'better-sqlite3'
import { projectMetaSchema, type ProjectMeta } from '../../shared/schemas/project'
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
  const version = Number(row?.value)
  if (!Number.isInteger(version)) throw notAProject()
  return version
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
