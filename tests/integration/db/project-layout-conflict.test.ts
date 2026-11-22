import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { closeProjectFile, createProjectFile, openProjectFile } from '@/main/db/project-file'

// LP-11 follow-up: SQLite's table and index descriptions do not show a conflict clause, so
// the check counts the word "conflict" in each object's SQL against the app's own layout.
const REFUSED = {
  code: 'INVALID_INPUT',
  message: 'This file is not an Adman project, or it is damaged.',
  details: { reason: 'not_a_project' },
}

let dir: string
let file: string
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-conflict-'))
  file = path.join(dir, 'A.adman')
  closeProjectFile(createProjectFile({ filePath: file, name: 'A', appVersion: '0.1.0', now: 'x' }))
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

// Rebuilds the report table from its own SQL with one change, as a hostile file could hold it.
function rebuildReport(change: (sql: string) => string) {
  const raw = new Database(file)
  const { sql } = raw.prepare("SELECT sql FROM sqlite_master WHERE name = 'report'").get() as {
    sql: string
  }
  const changed = change(sql)
  expect(changed).not.toBe(sql)
  raw.exec(`${changed.replace('CREATE TABLE `report`', 'CREATE TABLE `report_new`')};
    INSERT INTO report_new SELECT * FROM report;
    DROP TABLE report;
    ALTER TABLE report_new RENAME TO report;`)
  raw.close()
}

function tamper(sql: string) {
  const raw = new Database(file)
  raw.exec(sql)
  raw.close()
}

function refusal(): unknown {
  try {
    closeProjectFile(openProjectFile({ filePath: file, appVersion: '0.1.0' }))
  } catch (e) {
    return e
  }
  throw new Error('The file opened.')
}

const ID_KEY = '`id` text PRIMARY KEY NOT NULL'
const BODY = '`body` text NOT NULL'

const hostile: Array<[string, () => void]> = [
  [
    'a primary key ON CONFLICT REPLACE',
    () =>
      rebuildReport((s) => s.replace(ID_KEY, '`id` text PRIMARY KEY ON CONFLICT REPLACE NOT NULL')),
  ],
  [
    'a primary key ON CONFLICT IGNORE',
    () =>
      rebuildReport((s) => s.replace(ID_KEY, '`id` text PRIMARY KEY ON CONFLICT IGNORE NOT NULL')),
  ],
  [
    'a lower-case on conflict replace',
    () =>
      rebuildReport((s) => s.replace(ID_KEY, '`id` text PRIMARY KEY on conflict replace NOT NULL')),
  ],
  [
    'a column NOT NULL ON CONFLICT REPLACE',
    () => rebuildReport((s) => s.replace(BODY, '`body` text NOT NULL ON CONFLICT REPLACE')),
  ],
  [
    "the word conflict in a comment of an app index's SQL",
    () =>
      tamper(`DROP INDEX job_status;
        CREATE INDEX job_status ON job (status, updated_at /* conflict */)`),
  ],
]

describe('a conflict clause in a project file is refused [LP-11]', () => {
  for (const [what, make] of hostile) {
    it(`refuses a file with ${what}, writing nothing to the file or beside it`, () => {
      make()
      const before = fs.readFileSync(file)
      const listing = fs.readdirSync(dir).sort()
      expect(refusal()).toMatchObject(REFUSED)
      expect(fs.readFileSync(file).equals(before)).toBe(true)
      expect(fs.readdirSync(dir).sort()).toEqual(listing)
    })
  }

  it('opens a file whose report table was rebuilt from its own SQL unchanged', () => {
    const raw = new Database(file)
    const { sql } = raw.prepare("SELECT sql FROM sqlite_master WHERE name = 'report'").get() as {
      sql: string
    }
    raw.exec(`${sql.replace('CREATE TABLE `report`', 'CREATE TABLE `report_new`')};
      DROP TABLE report;
      ALTER TABLE report_new RENAME TO report;`)
    raw.close()
    closeProjectFile(openProjectFile({ filePath: file, appVersion: '0.1.0' }))
  })
})
