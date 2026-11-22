import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { closeProjectFile, createProjectFile, openProjectFile } from '@/main/db/project-file'

// LP-11 follow-up: claims the layout check makes that no earlier test proved.
const REFUSED = {
  code: 'INVALID_INPUT',
  message: 'This file is not an Adman project, or it is damaged.',
  details: { reason: 'not_a_project' },
}

let dir: string
let file: string
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-claims-'))
  file = path.join(dir, 'A.adman')
  closeProjectFile(createProjectFile({ filePath: file, name: 'A', appVersion: '0.1.0', now: 'x' }))
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

function tamper(sql: string) {
  const raw = new Database(file)
  raw.exec(sql)
  raw.close()
}

// Rebuilds the report table from its own SQL with one change, as a hostile file could hold it.
function rebuildReport(change: (sql: string) => string) {
  const raw = new Database(file)
  const { sql } = raw.prepare("SELECT sql FROM sqlite_master WHERE name = 'report'").get() as {
    sql: string
  }
  const changed = change(sql)
  expect(changed).not.toBe(sql)
  raw.exec(`${changed.replace('CREATE TABLE `report`', 'CREATE TABLE `report_new`')};
    DROP TABLE report;
    ALTER TABLE report_new RENAME TO report;`)
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

function expectRefusedUnchanged() {
  const before = fs.readFileSync(file)
  const listing = fs.readdirSync(dir).sort()
  expect(refusal()).toMatchObject(REFUSED)
  expect(fs.readFileSync(file).equals(before)).toBe(true)
  expect(fs.readdirSync(dir).sort()).toEqual(listing)
}

describe('layout check claims, each proved [LP-11]', () => {
  it('refuses a foreign key that keeps its target but changes its ON DELETE action', () => {
    rebuildReport((s) => s.replace('ON DELETE cascade', 'ON DELETE set null'))
    expectRefusedUnchanged()
  })

  it('refuses a foreign key that keeps its target but changes its ON UPDATE action', () => {
    rebuildReport((s) => s.replace('ON UPDATE no action', 'ON UPDATE cascade'))
    expectRefusedUnchanged()
  })

  it('SQLite cannot make a second index whose name differs only in letter case', () => {
    expect(() => tamper('CREATE INDEX JOB_STATUS ON job (status, updated_at)')).toThrow(
      /already exists/,
    )
  })

  it('refuses an app index remade under its name in another letter case', () => {
    tamper('DROP INDEX job_status; CREATE INDEX JOB_STATUS ON job (status, updated_at)')
    expectRefusedUnchanged()
  })

  // The app never runs ANALYZE, so SQLite's statistics table is an object the app's
  // migrations do not make.
  it('refuses a file holding sqlite_stat1 from ANALYZE', () => {
    tamper('ANALYZE')
    const raw = new Database(file, { readonly: true })
    const stat = raw.prepare("SELECT name FROM sqlite_master WHERE name = 'sqlite_stat1'").get()
    raw.close()
    expect(stat).toEqual({ name: 'sqlite_stat1' })
    expectRefusedUnchanged()
  })
})
