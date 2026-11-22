import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { closeProjectFile, createProjectFile, openProjectFile } from '@/main/db/project-file'
import { bundledMigrations } from '@/main/db/bundled-migrations'
import { readMeta } from '@/main/db/meta'

// LP-11: a project file may come from anyone, so the app reads its layout before any write.
const REFUSED = {
  code: 'INVALID_INPUT',
  message: 'This file is not an Adman project, or it is damaged.',
  details: { reason: 'not_a_project' },
}

let dir: string
let file: string
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-layout-'))
  file = path.join(dir, 'A.adman')
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

function makeFile(steps = bundledMigrations.length) {
  const migrations = bundledMigrations.slice(0, steps)
  closeProjectFile(
    createProjectFile({ filePath: file, name: 'A', appVersion: '0.1.0', now: 'x', migrations }),
  )
}

// Changes the file by plain SQL, as a hostile project file could hold it.
function tamper(sql: string) {
  const raw = new Database(file)
  raw.exec(sql)
  raw.close()
}

const open = () => openProjectFile({ filePath: file, appVersion: '0.1.0' })

function refusal(): unknown {
  try {
    closeProjectFile(open())
  } catch (e) {
    return e
  }
  throw new Error('The file opened.')
}

const REBUILD_REPORT = (columns: string) => `
  CREATE TABLE report_new (${columns});
  INSERT INTO report_new SELECT * FROM report;
  DROP TABLE report;
  ALTER TABLE report_new RENAME TO report;`

const hostile: Array<[string, string]> = [
  [
    'a trigger',
    'CREATE TRIGGER trg_marker_zq AFTER UPDATE ON project_meta BEGIN DELETE FROM campaign; END',
  ],
  ['a view', 'CREATE VIEW view_marker_zq AS SELECT 1 AS one'],
  ['a view standing in for a table', 'DROP TABLE report; CREATE VIEW report AS SELECT 1 AS id'],
  ['an extra table', 'CREATE TABLE extra_marker_zq (id TEXT PRIMARY KEY)'],
  ['a virtual table', 'CREATE VIRTUAL TABLE vt_marker_zq USING fts5(body)'],
  ['an extra index on a known table', 'CREATE INDEX asset_marker_zq ON asset (display_name)'],
  [
    "an expression index under the app's own index name",
    'DROP INDEX asset_subject; CREATE INDEX asset_subject ON asset (lower(subject_id))',
  ],
  [
    "a partial index under the app's own index name",
    'DROP INDEX job_status; CREATE INDEX job_status ON job (status, updated_at) WHERE status = 1',
  ],
  [
    'a known table without its primary key',
    REBUILD_REPORT('id, campaign_id, created_at, output_dir, body'),
  ],
  ['a known table with an extra column', 'ALTER TABLE campaign ADD extra_marker_zq text'],
  [
    'a known table whose foreign key points elsewhere',
    REBUILD_REPORT(`id text PRIMARY KEY NOT NULL, campaign_id text NOT NULL REFERENCES subject(id)
      ON DELETE cascade, created_at text NOT NULL, output_dir text NOT NULL, body text NOT NULL`),
  ],
]

function canMakeVirtualTable(): boolean {
  const mem = new Database(':memory:')
  try {
    mem.exec('CREATE VIRTUAL TABLE t USING fts5(body)')
    return true
  } catch {
    return false
  } finally {
    mem.close()
  }
}

describe('project file layout is checked before any write [LP-11]', () => {
  it('the bundled SQLite can make a virtual table (else the virtual-table case means nothing)', () => {
    expect(canMakeVirtualTable()).toBe(true)
  })

  for (const [what, sql] of hostile) {
    it(`refuses a file with ${what}, writing nothing to the file or beside it`, () => {
      makeFile()
      tamper(sql)
      const before = fs.readFileSync(file)
      const listing = fs.readdirSync(dir).sort()
      expect(refusal()).toMatchObject(REFUSED)
      expect(fs.readFileSync(file).equals(before)).toBe(true)
      expect(fs.readdirSync(dir).sort()).toEqual(listing)
    })
  }

  it('refuses a file at the first step that holds a trigger, with no .bak made', () => {
    makeFile(1)
    tamper('CREATE TRIGGER trg_marker_zq AFTER INSERT ON campaign BEGIN DELETE FROM subject; END')
    const before = fs.readFileSync(file)
    expect(refusal()).toMatchObject(REFUSED)
    expect(fs.readFileSync(file).equals(before)).toBe(true)
    expect(fs.readdirSync(dir)).toEqual(['A.adman'])
  })

  it('refuses a file at the first step that holds a table only a later step makes', () => {
    makeFile(1)
    const later = bundledMigrations
      .slice(4, 5)
      .flatMap((m) => m.statements)
      .filter((s) => s.startsWith('CREATE TABLE `approval_link`'))
    expect(later).toHaveLength(1)
    tamper(later[0] ?? '')
    expect(refusal()).toMatchObject(REFUSED)
    expect(fs.readdirSync(dir)).toEqual(['A.adman'])
  })

  it('names nothing from the file in the error', () => {
    makeFile()
    tamper('CREATE TRIGGER trg_marker_zq AFTER UPDATE ON project_meta BEGIN SELECT 1; END')
    const error = refusal() as Error & { details?: unknown }
    expect(error.message).not.toContain('marker_zq')
    expect(JSON.stringify(error.details)).not.toContain('marker_zq')
    expect(String(error.stack)).not.toContain('marker_zq')
    expect(error.cause).toBeUndefined()
  })

  it('opens a file the app made', () => {
    makeFile()
    const h = open()
    expect(readMeta(h.db).name).toBe('A')
    closeProjectFile(h)
  })

  it('opens and migrates a file at every older step', () => {
    for (let steps = 1; steps < bundledMigrations.length; steps += 1) {
      makeFile(steps)
      const h = open()
      expect(readMeta(h.db).schemaVersion).toBe(bundledMigrations.length)
      closeProjectFile(h)
      fs.rmSync(dir, { recursive: true, force: true })
      fs.mkdirSync(dir)
    }
  })

  it('sets trusted_schema off on every project connection', () => {
    const created = createProjectFile({ filePath: file, name: 'A', appVersion: '0.1.0', now: 'x' })
    expect(created.db.pragma('trusted_schema', { simple: true })).toBe(0)
    closeProjectFile(created)
    const opened = open()
    expect(opened.db.pragma('trusted_schema', { simple: true })).toBe(0)
    closeProjectFile(opened)
  })
})
