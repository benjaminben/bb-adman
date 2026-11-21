// Opens, creates and closes project files (SPEC 3.1, 3.8).
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { ulid } from 'ulid'
import * as schema from './schema'
import { bundledMigrations, type Migration } from './bundled-migrations'
import { readMeta, readSchemaVersion, readStoredName, writeMeta, notAProject } from './meta'
import { AppError } from '../../shared/schemas/result'

// Only the project ID is kept in memory; project_meta is the owner of every other value
// and readers call readMeta (SPEC 3.3).
export type ProjectHandle = {
  db: Database.Database
  orm: BetterSQLite3Database<typeof schema>
  filePath: string
  projectId: string
}

export const NEWER_VERSION_MESSAGE =
  'This project was made with a newer version of the app. Download the latest version to open it.'
const LOCKED_MESSAGE = 'This project is open in another copy of the app.'

function sqliteCode(e: unknown): string | undefined {
  return typeof e === 'object' && e !== null && 'code' in e ? String(e.code) : undefined
}

function mapOpenError(e: unknown): unknown {
  if (e instanceof AppError) return e
  const code = sqliteCode(e) ?? ''
  if (code.startsWith('SQLITE_BUSY') || code.startsWith('SQLITE_LOCKED')) {
    return new AppError('PROJECT_LOCKED', LOCKED_MESSAGE)
  }
  if (code.startsWith('SQLITE_NOTADB') || code.startsWith('SQLITE_CORRUPT')) {
    return notAProject()
  }
  return e
}

// Applies the SPEC 3.1 settings and takes the exclusive lock at once by starting
// an exclusive transaction. In EXCLUSIVE locking mode the lock is kept until close.
function connect(filePath: string, create: boolean): Database.Database {
  const db = new Database(filePath, { fileMustExist: !create, timeout: 0 })
  try {
    db.pragma('locking_mode = EXCLUSIVE')
    db.exec('BEGIN EXCLUSIVE')
    db.exec('COMMIT')
    db.pragma('journal_mode = DELETE')
    db.pragma('synchronous = FULL')
    db.pragma('foreign_keys = ON')
    return db
  } catch (e) {
    db.close()
    throw mapOpenError(e)
  }
}

// SPEC 3.8: SQLite ignores PRAGMA foreign_keys inside a transaction, and a drizzle-kit
// table rebuild with foreign keys on can fail or delete child rows. So foreign keys are
// off for the migration and checked by hand before commit. On failure nothing changes.
function runMigrations(db: Database.Database, migrations: Migration[], from: number): void {
  db.pragma('foreign_keys = OFF')
  try {
    db.transaction(() => {
      for (const migration of migrations.slice(from)) {
        for (const statement of migration.statements) db.exec(statement)
      }
      const broken = db.pragma('foreign_key_check') as unknown[]
      if (broken.length > 0) {
        throw new Error(`Migration left ${broken.length} rows that break a foreign key.`)
      }
      writeMeta(db, { schemaVersion: migrations.length })
    })()
  } finally {
    db.pragma('foreign_keys = ON')
  }
}

function handle(db: Database.Database, filePath: string): ProjectHandle {
  const { projectId } = readMeta(db)
  return { db, orm: drizzle({ client: db, schema }), filePath, projectId }
}

export function createProjectFile(opts: {
  filePath: string
  name: string
  appVersion: string
  now: string
  migrations?: Migration[]
}): ProjectHandle {
  const migrations = opts.migrations ?? bundledMigrations
  if (fs.existsSync(opts.filePath)) {
    throw new AppError('RULE_VIOLATION', 'A file with this name already exists in that folder.', {
      reason: 'file_exists',
    })
  }
  const db = connect(opts.filePath, true)
  try {
    const assetsDirRel = `${opts.name} Assets`
    runMigrations(db, migrations, 0)
    writeMeta(db, {
      projectId: ulid(),
      name: opts.name,
      createdAppVersion: opts.appVersion,
      assetsDirRel,
      assetsDirAbs: path.join(path.dirname(opts.filePath), assetsDirRel),
      createdAt: opts.now,
    })
    return handle(db, opts.filePath)
  } catch (e) {
    db.close()
    fs.rmSync(opts.filePath, { force: true })
    throw e
  }
}

export function openProjectFile(opts: {
  filePath: string
  appVersion: string
  migrations?: Migration[]
}): ProjectHandle {
  const migrations = opts.migrations ?? bundledMigrations
  if (!fs.existsSync(opts.filePath)) {
    throw new AppError('NOT_FOUND', 'The project file could not be found.')
  }
  const db = connect(opts.filePath, false)
  try {
    const version = readSchemaVersion(db)
    if (version > migrations.length) {
      throw new AppError('RULE_VIOLATION', NEWER_VERSION_MESSAGE, { reason: 'newer_version' })
    }
    if (version < migrations.length) {
      readStoredName(db)
      fs.copyFileSync(opts.filePath, `${opts.filePath}.bak`)
      runMigrations(db, migrations, version)
    }
    return handle(db, opts.filePath)
  } catch (e) {
    db.close()
    throw mapOpenError(e)
  }
}

export function closeProjectFile(h: ProjectHandle): void {
  if (h.db.open) h.db.close()
}
