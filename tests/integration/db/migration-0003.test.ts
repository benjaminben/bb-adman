// P4-1 (spec/ai-jobs.md "Job kinds"): migration 0003 rebuilds the job table so its job_kind
// CHECK lists cutout. Every existing row survives unchanged.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import type { Database } from 'better-sqlite3'
import {
  createProjectFile,
  openProjectFile,
  closeProjectFile,
  type ProjectHandle,
} from '@/main/db/project-file'
import { readMeta } from '@/main/db/meta'
import { bundledMigrations } from '@/main/db/bundled-migrations'

let dir: string | undefined
afterEach(() => {
  if (dir) fs.rmSync(dir, { recursive: true, force: true })
  dir = undefined
})

const SEED = `
  INSERT INTO job (id, kind, status, campaign_id, variant_id, layer_id, slot, provider, model,
    request, remote_job_id, result, error_kind, error_detail, progress, paid_calls, seen_at,
    started_by, error_reason, created_at, updated_at)
    VALUES ('j1', 'image_generation', 'failed', 'c1', 'v1', 'l1', 'background', 'comfyui', 'm',
    '{"a":1}', 'r1', '{"assetIds":["a1"]}', 'other', 'run_failed', 0.5, 2, 'z', 'agent',
    'run_failed', 'x', 'y');
  INSERT INTO asset (id, library, kind, origin, storage, display_name, abs_path, rel_path, mime,
    byte_size, mtime_ms, content_hash, width, height, gen_run_id, gen_provider, gen_model,
    gen_prompt, created_at)
    VALUES ('a1', 'asset', 'image', 'generated', 'managed', 'Shoe', '/p/a.png', 'a.png',
    'image/png', 10, 1, 'h', 4, 4, 'j1', 'comfyui', 'm', 'A shoe', 'x');
`

function row(db: Database, sql: string): Record<string, unknown> {
  return db.prepare(sql).get() as Record<string, unknown>
}

function insertKind(db: Database, id: string, kind: string): void {
  db.prepare(
    `INSERT INTO job (id, kind, status, provider, model, request, created_at, updated_at)
     VALUES (?, ?, 'queued', 'fake', '', '{}', 'x', 'x')`,
  ).run(id, kind)
}

function makeFile(name: string, count: number): ProjectHandle {
  dir ??= fs.mkdtempSync(path.join(os.tmpdir(), 'adman-0003-'))
  return createProjectFile({
    filePath: path.join(dir, `${name}.adman`),
    name,
    appVersion: '0.1.0',
    now: 'x',
    migrations: bundledMigrations.slice(0, count),
  })
}

describe('migration 0003 [spec/ai-jobs.md "Job kinds"]', () => {
  it('lists the four migrations in order', () => {
    expect(bundledMigrations.slice(0, 4).map((m) => m.tag)).toEqual([
      '0000_initial',
      '0001_agent_changed_and_job_target',
      '0002_job_started_by_and_error_reason',
      '0003_job_kind_cutout',
    ])
  })

  it('upgrades a version 3 file to 4: the job row and the asset naming it unchanged', () => {
    const v3 = makeFile('A', 3)
    const filePath = v3.filePath
    v3.db.exec(SEED)
    const jobBefore = row(v3.db, "SELECT * FROM job WHERE id = 'j1'")
    const assetBefore = row(v3.db, "SELECT * FROM asset WHERE id = 'a1'")
    closeProjectFile(v3)

    const h = openProjectFile({
      filePath,
      appVersion: '0.1.0',
      migrations: bundledMigrations.slice(0, 4),
    })
    expect(readMeta(h.db).schemaVersion).toBe(4)
    expect(row(h.db, "SELECT * FROM job WHERE id = 'j1'")).toEqual(jobBefore)
    expect(row(h.db, "SELECT * FROM asset WHERE id = 'a1'")).toEqual(assetBefore)
    expect(row(h.db, 'SELECT COUNT(*) AS n FROM job')).toEqual({ n: 1 })
    closeProjectFile(h)
  })

  it('keeps the other checks and the two indexes of the job table', () => {
    const h = makeFile('C', 4)
    insertKind(h.db, 'j1', 'cutout')
    const set = (column: string, value: string) =>
      h.db.prepare(`UPDATE job SET ${column} = ? WHERE id = 'j1'`).run(value)
    expect(() => set('status', 'lost')).toThrow(/CHECK constraint failed/)
    expect(() => set('error_kind', 'nope')).toThrow(/CHECK constraint failed/)
    expect(() => set('started_by', 'robot')).toThrow(/CHECK constraint failed/)
    const indexes = h.db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'job' AND sql IS NOT NULL")
      .all()
      .map((r) => (r as { name: string }).name)
      .sort()
    expect(indexes).toEqual(['job_status', 'job_target'])
    closeProjectFile(h)
  })

  it.each([
    ['an upgraded file', true],
    ['a new file', false],
  ])('%s accepts cutout and refuses robot', (_name, upgraded) => {
    let h = makeFile(upgraded ? 'U' : 'N', upgraded ? 3 : 4)
    if (upgraded) {
      const filePath = h.filePath
      closeProjectFile(h)
      h = openProjectFile({ filePath, appVersion: '0.1.0', migrations: bundledMigrations })
    }
    insertKind(h.db, 'k1', 'cutout')
    expect(() => insertKind(h.db, 'k2', 'robot')).toThrow(/CHECK constraint failed/)
    closeProjectFile(h)
  })
})
