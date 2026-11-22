// R2V-3 (spec/phases/round-2-approvals-video.md "Contract and data changes"): migration 0006
// adds three nullable columns to approval_variant, clip_ms, clip_bytes and clip_missing. It
// only adds: every row of a version 6 file survives, and an old gallery row reads null.
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
import { readVariants } from '@/main/approvals/local-store'
import type { ActivityLog } from '@/main/log/activity-log'

let dir: string | undefined
let open: ProjectHandle | undefined
afterEach(() => {
  if (open) closeProjectFile(open)
  if (dir) fs.rmSync(dir, { recursive: true, force: true })
  dir = open = undefined
})

const EXPIRES = '2026-11-28T10:00:00.000Z'
const SEED = `
  INSERT INTO campaign (id, name, region, audience, message, primary_language, languages, sizes,
    template_id, brief, created_by, created_at)
    VALUES ('spring-sale-abc234', 'C', 'US', 'all', 'Hello', 'en-US', '["en-US"]', '[]',
    'starter', '{}', 'user', 'x');
  INSERT INTO direction (id, campaign_id, name, master_variant_id, sort)
    VALUES ('d1', 'spring-sale-abc234', 'A', 'k3f9q2', 0);
  INSERT INTO variant (id, direction_id, title, width, height, size_label, language, format,
    duration_ms, rev, created_by, created_at)
    VALUES ('k3f9q2', 'd1', 'Shoe', 1080, 1920, '9x16', 'en-US', 'video', 8000, 3, 'user', 'x'),
           ('aaaaaa', 'd1', 'Shoe', 1080, 1080, '1x1', 'en-US', 'image', 6000, 1, 'user', 'x');
  INSERT INTO approval_link (campaign_id, slug, state, created_at, published_at, checked_at,
    ended_at) VALUES ('spring-sale-abc234', 'AbCdEfGhJkMn', 'live', 'x', 'y', NULL, NULL);
  INSERT INTO approval_variant (campaign_id, variant_id, published_rev, expires_at)
    VALUES ('spring-sale-abc234', 'k3f9q2', 3, '${EXPIRES}'),
           ('spring-sale-abc234', 'aaaaaa', 1, '${EXPIRES}');
`

const all = (db: Database, sql: string) => db.prepare(sql).all() as Record<string, unknown>[]
const NEW_COLUMNS = ['clip_ms', 'clip_bytes', 'clip_missing']

function makeFile(migrations: number): ProjectHandle {
  dir ??= fs.mkdtempSync(path.join(os.tmpdir(), 'adman-0006-'))
  return createProjectFile({
    filePath: path.join(dir, 'A.adman'),
    name: 'A',
    appVersion: '0.1.0',
    now: 'x',
    migrations: bundledMigrations.slice(0, migrations),
  })
}

function upgradedFile(): { h: ProjectHandle; before: Record<string, unknown>[][] } {
  const v6 = makeFile(6)
  v6.db.exec(SEED)
  const tables = ['approval_link', 'approval_variant', 'variant']
  const before = tables.map((t) => all(v6.db, `SELECT * FROM ${t} ORDER BY rowid`))
  const filePath = v6.filePath
  closeProjectFile(v6)
  open = openProjectFile({ filePath, appVersion: '0.1.0', migrations: bundledMigrations })
  return { h: open, before }
}

const quietLog = { write: () => undefined } as unknown as ActivityLog

describe('migration 0006 [R2V-3, spec/data-rules.md "Data migration"]', () => {
  it('is the seventh migration, after the six before it', () => {
    expect(bundledMigrations.map((m) => m.tag)).toEqual([
      '0000_initial',
      '0001_agent_changed_and_job_target',
      '0002_job_started_by_and_error_reason',
      '0003_job_kind_cutout',
      '0004_approvals',
      '0005_video_and_sound',
      '0006_approval_clips',
    ])
  })

  it('only adds the three nullable columns to approval_variant', () => {
    expect(bundledMigrations[6]?.statements).toEqual([
      'ALTER TABLE `approval_variant` ADD `clip_ms` integer;',
      'ALTER TABLE `approval_variant` ADD `clip_bytes` integer;',
      'ALTER TABLE `approval_variant` ADD `clip_missing` text;',
    ])
  })

  it('upgrades a version 6 file to 7, keeping every row, with the new columns null', () => {
    const { h, before } = upgradedFile()
    expect(readMeta(h.db).schemaVersion).toBe(7)
    const columns = all(h.db, 'PRAGMA table_info(approval_variant)')
    for (const name of NEW_COLUMNS) {
      expect(columns.find((c) => c.name === name)).toMatchObject({ notnull: 0, dflt_value: null })
    }
    const tables = ['approval_link', 'approval_variant', 'variant']
    const after = tables.map((t) => all(h.db, `SELECT * FROM ${t} ORDER BY rowid`))
    expect(after[0]).toEqual(before[0])
    expect(after[2]).toEqual(before[2])
    expect(after[1]).toEqual(
      before[1]!.map((r) => ({ ...r, clip_ms: null, clip_bytes: null, clip_missing: null })),
    )
    expect(all(h.db, 'PRAGMA foreign_key_check')).toEqual([])
  })

  it('reads an old gallery row with no clip numbers and no reason', () => {
    const { h } = upgradedFile()
    expect(readVariants(h.db, 'spring-sale-abc234', quietLog)).toEqual([
      {
        variantId: 'aaaaaa',
        publishedRev: 1,
        expiresAt: EXPIRES,
        clipMs: null,
        clipBytes: null,
        clipMissing: null,
      },
      {
        variantId: 'k3f9q2',
        publishedRev: 3,
        expiresAt: EXPIRES,
        clipMs: null,
        clipBytes: null,
        clipMissing: null,
      },
    ])
  })
})
