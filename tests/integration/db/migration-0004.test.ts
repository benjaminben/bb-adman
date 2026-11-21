// AP-5 (spec/approvals.md "Local tables"): migration 0004 adds the three approvals tables and
// their index. No rebuild: every row of a version 4 file survives unchanged.
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
let open: ProjectHandle | undefined
afterEach(() => {
  if (open) closeProjectFile(open)
  if (dir) fs.rmSync(dir, { recursive: true, force: true })
  dir = open = undefined
})

const SEED = `
  INSERT INTO campaign (id, name, region, audience, message, primary_language, languages, sizes,
    template_id, brief, created_by, created_at)
    VALUES ('c1', 'C', 'US', 'all', 'Hello', 'en-US', '["en-US"]', '[]', 'starter', '{}', 'user', 'x');
  INSERT INTO direction (id, campaign_id, name, master_variant_id, sort)
    VALUES ('d1', 'c1', 'A', 'v1', 0);
  INSERT INTO variant (id, direction_id, title, width, height, size_label, language, format,
    duration_ms, rev, created_by, created_at)
    VALUES ('v1', 'd1', 'Shoe', 1080, 1080, '1x1', 'en-US', 'image', 6000, 3, 'agent', 'x');
  INSERT INTO job (id, kind, status, campaign_id, variant_id, provider, model, request,
    created_at, updated_at)
    VALUES ('j1', 'cutout', 'queued', 'c1', 'v1', 'fake', 'm', '{"a":1}', 'x', 'y');
`

const LINK = `
  INSERT INTO approval_link (campaign_id, slug, state, created_at)
    VALUES ('c1', 'AbCdEfGhJkLm', 'live', 'x');
  INSERT INTO approval_variant (campaign_id, variant_id, published_rev, expires_at)
    VALUES ('c1', 'v1', 3, 'y');
  INSERT INTO approval_signoff (id, campaign_id, variant_id, version, email, signed_at)
    VALUES ('AbCdEfGhJkLmNoPqRsTuVwXy', 'c1', 'v1', 3, 'a@example.com', 'z');
`

const all = (db: Database, sql: string) => db.prepare(sql).all() as Record<string, unknown>[]
const count = (db: Database, table: string) =>
  (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n

function makeFile(name: string, migrations: number): ProjectHandle {
  dir ??= fs.mkdtempSync(path.join(os.tmpdir(), 'adman-0004-'))
  return createProjectFile({
    filePath: path.join(dir, `${name}.adman`),
    name,
    appVersion: '0.1.0',
    now: 'x',
    migrations: bundledMigrations.slice(0, migrations),
  })
}

function upgradedFile(): ProjectHandle {
  const v4 = makeFile('A', 4)
  const filePath = v4.filePath
  v4.db.exec(SEED)
  closeProjectFile(v4)
  open = openProjectFile({
    filePath,
    appVersion: '0.1.0',
    migrations: bundledMigrations.slice(0, 5),
  })
  return open
}

describe('migration 0004 [spec/approvals.md "Local tables"]', () => {
  it('is the fifth migration, after the four before it', () => {
    expect(bundledMigrations.slice(0, 5).map((m) => m.tag)).toEqual([
      '0000_initial',
      '0001_agent_changed_and_job_target',
      '0002_job_started_by_and_error_reason',
      '0003_job_kind_cutout',
      '0004_approvals',
    ])
  })

  it('only creates tables and an index: nothing is rebuilt, altered or dropped', () => {
    const statements = bundledMigrations[4]?.statements ?? []
    expect(statements).toHaveLength(4)
    for (const s of statements) expect(s).toMatch(/^CREATE (TABLE|INDEX) `approval_/)
  })

  it('upgrades a version 4 file to 5, keeping every row', () => {
    const v4 = makeFile('A', 4)
    const filePath = v4.filePath
    v4.db.exec(SEED)
    const before = ['campaign', 'direction', 'variant', 'job'].map((t) =>
      all(v4.db, `SELECT * FROM ${t}`),
    )
    closeProjectFile(v4)
    open = openProjectFile({
      filePath,
      appVersion: '0.1.0',
      migrations: bundledMigrations.slice(0, 5),
    })
    expect(readMeta(open.db).schemaVersion).toBe(5)
    const after = ['campaign', 'direction', 'variant', 'job'].map((t) =>
      all(open!.db, `SELECT * FROM ${t}`),
    )
    expect(after).toEqual(before)
  })

  it('has the three tables and the sign-off index', () => {
    const h = upgradedFile()
    const names = all(
      h.db,
      "SELECT name FROM sqlite_master WHERE name LIKE 'approval%' AND sql IS NOT NULL ORDER BY name",
    ).map((r) => r.name)
    expect(names).toEqual([
      'approval_link',
      'approval_signoff',
      'approval_signoff_campaign',
      'approval_variant',
    ])
  })

  it.each([
    ['an upgraded file', true],
    ['a new file', false],
  ])('%s accepts live and ended and refuses paused', (_name, upgraded) => {
    const h = upgraded ? upgradedFile() : (open = makeFile('N', 5))
    if (!upgraded) h.db.exec(SEED)
    const insert = (id: string, state: string) =>
      h.db
        .prepare(
          `INSERT INTO approval_link (campaign_id, slug, state, created_at) VALUES (?, 'AbCdEfGhJkLm', ?, 'x')`,
        )
        .run(id, state)
    expect(() => insert('c1', 'paused')).toThrow(/CHECK constraint failed/)
    insert('c1', 'live')
    h.db.prepare("UPDATE approval_link SET state = 'ended' WHERE campaign_id = 'c1'").run()
    expect(() =>
      h.db.prepare("UPDATE approval_link SET state = 'paused' WHERE campaign_id = 'c1'").run(),
    ).toThrow(/CHECK constraint failed/)
  })

  it('removes every approval row of a campaign when the campaign is deleted', () => {
    const h = upgradedFile()
    h.db.exec(LINK)
    h.db.prepare("DELETE FROM campaign WHERE id = 'c1'").run()
    for (const t of ['approval_link', 'approval_variant', 'approval_signoff']) {
      expect(count(h.db, t), t).toBe(0)
    }
  })

  it("removes a deleted variant's approval_variant row and keeps its sign-offs", () => {
    const h = upgradedFile()
    h.db.exec(LINK)
    h.db.prepare("DELETE FROM variant WHERE id = 'v1'").run()
    expect(count(h.db, 'approval_variant')).toBe(0)
    expect(count(h.db, 'approval_link')).toBe(1)
    expect(all(h.db, 'SELECT variant_id, version FROM approval_signoff')).toEqual([
      { variant_id: 'v1', version: 3 },
    ])
  })

  it('refuses an approval_variant row for a campaign without a link', () => {
    const h = upgradedFile()
    expect(() =>
      h.db
        .prepare(
          "INSERT INTO approval_variant (campaign_id, variant_id, published_rev, expires_at) VALUES ('c1', 'v1', 3, 'y')",
        )
        .run(),
    ).toThrow(/FOREIGN KEY constraint failed/)
  })
})
