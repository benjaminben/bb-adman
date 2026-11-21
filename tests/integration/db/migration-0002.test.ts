import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import {
  createProjectFile,
  openProjectFile,
  closeProjectFile,
} from '../../../src/main/db/project-file'
import { readMeta } from '../../../src/main/db/meta'
import { bundledMigrations } from '../../../src/main/db/bundled-migrations'

let dir: string | undefined
afterEach(() => {
  if (dir) fs.rmSync(dir, { recursive: true, force: true })
  dir = undefined
})

const JOB = `
  INSERT INTO job (id, kind, status, provider, model, request, result, progress, paid_calls, created_at, updated_at)
    VALUES ('j1', 'image_generation', 'succeeded', 'fake', 'm', '{"a":1}', '{"b":2}', 1, 1, 'x', 'y');
`

function row(db: import('better-sqlite3').Database, sql: string): Record<string, unknown> {
  return db.prepare(sql).get() as Record<string, unknown>
}

function setStartedBy(db: import('better-sqlite3').Database, value: string): void {
  db.prepare("UPDATE job SET started_by = ? WHERE id = 'j1'").run(value)
}

describe('migration 0002 [SPEC 3.8, 6.11.1]', () => {
  it('lists exactly the three migrations in order', () => {
    expect(bundledMigrations.map((m) => m.tag)).toEqual([
      '0000_initial',
      '0001_agent_changed_and_job_target',
      '0002_job_started_by_and_error_reason',
    ])
  })

  it('upgrades a version 2 file: the job row unchanged apart from the two new fields', () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-0002-'))
    const filePath = path.join(dir, 'A.adman')
    const v2 = createProjectFile({
      filePath,
      name: 'A',
      appVersion: '0.1.0',
      now: 'x',
      migrations: bundledMigrations.slice(0, 2),
    })
    v2.db.exec(JOB)
    const jobBefore = row(v2.db, "SELECT * FROM job WHERE id = 'j1'")
    closeProjectFile(v2)

    const h = openProjectFile({ filePath, appVersion: '0.1.0', migrations: bundledMigrations })
    expect(readMeta(h.db).schemaVersion).toBe(3)
    expect(row(h.db, "SELECT * FROM job WHERE id = 'j1'")).toEqual({
      ...jobBefore,
      started_by: 'user',
      error_reason: null,
    })
    expect(() => setStartedBy(h.db, 'robot')).toThrow(/CHECK constraint failed/)
    setStartedBy(h.db, 'agent')
    expect(row(h.db, "SELECT started_by FROM job WHERE id = 'j1'")).toEqual({
      started_by: 'agent',
    })
    closeProjectFile(h)
  })

  it('a new project file made with the full list refuses started_by robot', () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-0002-'))
    const h = createProjectFile({
      filePath: path.join(dir, 'B.adman'),
      name: 'B',
      appVersion: '0.1.0',
      now: 'x',
      migrations: bundledMigrations,
    })
    h.db.exec(JOB)
    expect(row(h.db, "SELECT started_by, error_reason FROM job WHERE id = 'j1'")).toEqual({
      started_by: 'user',
      error_reason: null,
    })
    expect(() => setStartedBy(h.db, 'robot')).toThrow(/CHECK constraint failed/)
    closeProjectFile(h)
  })
})
