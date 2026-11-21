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
})

const SEED = `
  INSERT INTO campaign (id, name, region, audience, message, primary_language, languages, sizes, template_id, brief, created_by, created_at)
    VALUES ('c1', 'C', 'US', 'all', 'Hello', 'en-US', '["en-US"]', '[]', 'starter', '{}', 'user', 'x');
  INSERT INTO direction (id, campaign_id, name, master_variant_id, sort) VALUES ('d1', 'c1', 'A', 'v1', 0);
  INSERT INTO variant (id, direction_id, title, width, height, size_label, language, format, duration_ms, rev, created_by, created_at)
    VALUES ('v1', 'd1', 'Shoe', 1080, 1080, '1x1', 'en-US', 'image', 6000, 3, 'agent', 'x');
  INSERT INTO job (id, kind, status, campaign_id, variant_id, provider, model, request, result, progress, created_at, updated_at)
    VALUES ('j1', 'image_generation', 'succeeded', 'c1', 'v1', 'fake', 'm', '{"a":1}', '{"b":2}', 1, 'x', 'y');
`

function row(db: import('better-sqlite3').Database, sql: string): Record<string, unknown> {
  return db.prepare(sql).get() as Record<string, unknown>
}

describe('migration 0001 [SPEC 3.8, 3.3]', () => {
  it('upgrades a version 1 file: variant and job rows unchanged apart from the new fields', () => {
    expect(bundledMigrations.map((m) => m.tag)).toHaveLength(2)
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-0001-'))
    const filePath = path.join(dir, 'A.adman')
    const v1 = createProjectFile({
      filePath,
      name: 'A',
      appVersion: '0.1.0',
      now: 'x',
      migrations: bundledMigrations.slice(0, 1),
    })
    v1.db.exec(SEED)
    const variantBefore = row(v1.db, "SELECT * FROM variant WHERE id = 'v1'")
    const jobBefore = row(v1.db, "SELECT * FROM job WHERE id = 'j1'")
    closeProjectFile(v1)

    const h = openProjectFile({ filePath, appVersion: '0.1.0' })
    expect(readMeta(h.db).schemaVersion).toBe(2)
    expect(row(h.db, "SELECT * FROM variant WHERE id = 'v1'")).toEqual({
      ...variantBefore,
      agent_changed_at: null,
    })
    expect(row(h.db, "SELECT * FROM job WHERE id = 'j1'")).toEqual({
      ...jobBefore,
      layer_id: null,
      slot: null,
      paid_calls: 0,
      seen_at: null,
    })
    const index = row(
      h.db,
      "SELECT sql FROM sqlite_master WHERE type = 'index' AND name = 'job_target'",
    )
    expect(String(index.sql).replace(/[`"\s]/g, '')).toBe(
      'CREATEINDEXjob_targetONjob(campaign_id,variant_id)',
    )
    closeProjectFile(h)
  })
})
