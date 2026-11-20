import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  createProjectFile,
  openProjectFile,
  closeProjectFile,
} from '../../../src/main/db/project-file'
import { readMeta } from '../../../src/main/db/meta'
import { bundledMigrations, type Migration } from '../../../src/main/db/bundled-migrations'
import { AppError } from '../../../src/shared/schemas/result'

let dir: string
let file: string
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-migrate-'))
  file = path.join(dir, 'A.adman')
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

// Test-only migrations: a parent table whose children are removed with ON DELETE CASCADE.
const parentAndChild: Migration = {
  tag: '9001_test_parent_child',
  statements: [
    'CREATE TABLE parent_test (id TEXT PRIMARY KEY)',
    'CREATE TABLE child_test (id TEXT PRIMARY KEY, parent_id TEXT NOT NULL REFERENCES parent_test(id) ON DELETE CASCADE)',
  ],
}

// The way drizzle-kit changes a column: new table, copy, drop, rename.
const rebuildParent: Migration = {
  tag: '9002_test_rebuild_parent',
  statements: [
    "CREATE TABLE __new_parent_test (id TEXT PRIMARY KEY, label TEXT NOT NULL DEFAULT '')",
    'INSERT INTO __new_parent_test (id) SELECT id FROM parent_test',
    'DROP TABLE parent_test',
    'ALTER TABLE __new_parent_test RENAME TO parent_test',
  ],
}

// Leaves child rows that point at nothing.
const orphanChildren: Migration = {
  tag: '9002_test_orphans',
  statements: [
    'CREATE TABLE __new_parent_test (id TEXT PRIMARY KEY)',
    'DROP TABLE parent_test',
    'ALTER TABLE __new_parent_test RENAME TO parent_test',
  ],
}

const v1 = [...bundledMigrations, parentAndChild]

function makeV1WithChildren(): void {
  const h = createProjectFile({
    filePath: file,
    name: 'A',
    appVersion: '0.1.0',
    now: 'x',
    migrations: v1,
  })
  h.db.exec(
    "INSERT INTO parent_test VALUES ('p1'); INSERT INTO child_test VALUES ('c1', 'p1'), ('c2', 'p1')",
  )
  closeProjectFile(h)
}

describe('migration runner and foreign keys [SPEC 3.8]', () => {
  it('rebuilds a parent table without deleting its child rows, and turns foreign keys back on', () => {
    makeV1WithChildren()
    const h = openProjectFile({
      filePath: file,
      appVersion: '0.2.0',
      migrations: [...v1, rebuildParent],
    })
    expect(readMeta(h.db).schemaVersion).toBe(v1.length + 1)
    expect(h.db.prepare('SELECT id FROM child_test ORDER BY id').all()).toEqual([
      { id: 'c1' },
      { id: 'c2' },
    ])
    expect(h.db.pragma('foreign_keys', { simple: true })).toBe(1)
    expect(h.db.pragma('foreign_key_check')).toEqual([])
    closeProjectFile(h)
  })

  it('refuses the open and leaves the file unchanged when foreign_key_check finds broken rows', () => {
    makeV1WithChildren()
    let thrown: unknown
    try {
      openProjectFile({ filePath: file, appVersion: '0.2.0', migrations: [...v1, orphanChildren] })
    } catch (e) {
      thrown = e
    }
    // A failed migration is a bug in the app, so it is not a known error: the bus turns it
    // into INTERNAL.
    expect(thrown).toBeInstanceOf(Error)
    expect(thrown).not.toBeInstanceOf(AppError)

    const db = new Database(file, { readonly: true })
    const version = db
      .prepare("SELECT value FROM project_meta WHERE key = 'schema_version'")
      .get() as { value: string }
    expect(Number(version.value)).toBe(v1.length)
    expect(db.prepare('SELECT count(*) AS n FROM parent_test').get()).toEqual({ n: 1 })
    expect(db.prepare('SELECT count(*) AS n FROM child_test').get()).toEqual({ n: 2 })
    db.close()
  })
})
