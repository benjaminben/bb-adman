// P7-2 (spec/phases/phase-07-slices.md): migration 0005 adds the sound fields and
// first_clip_made to variant, sound_on to background_clip, and rebuilds asset so its kind
// CHECK lists audio. Every row of a version 5 file survives, with only the new fields added.
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
import { readWireRow } from '@/main/db/rows'
import { bundledMigrations } from '@/main/db/bundled-migrations'

let dir: string | undefined
let open: ProjectHandle | undefined
afterEach(() => {
  if (open) closeProjectFile(open)
  if (dir) fs.rmSync(dir, { recursive: true, force: true })
  dir = open = undefined
})

const SEED = `
  INSERT INTO subject (id, name, created_at) VALUES ('s1', 'Runner', 'x');
  INSERT INTO campaign (id, name, region, audience, message, primary_language, languages, sizes,
    template_id, brief, created_by, created_at)
    VALUES ('c1', 'C', 'US', 'all', 'Hello', 'en-US', '["en-US"]', '[]', 'starter', '{}', 'user', 'x');
  INSERT INTO direction (id, campaign_id, name, master_variant_id, sort)
    VALUES ('d1', 'c1', 'A', 'v1', 0);
  INSERT INTO variant (id, direction_id, title, width, height, size_label, language, format,
    duration_ms, rev, created_by, created_at)
    VALUES ('v1', 'd1', 'Shoe', 1080, 1920, '9x16', 'en-US', 'video', 8000, 3, 'agent', 'x'),
           ('v2', 'd1', 'Shoe', 1080, 1080, '1x1', 'en-US', 'image', 6000, 1, 'user', 'x');
  INSERT INTO variant_subject (variant_id, subject_id) VALUES ('v1', 's1');
  INSERT INTO asset (id, library, kind, origin, storage, subject_id, display_name, abs_path,
    rel_path, mime, byte_size, mtime_ms, content_hash, width, height, duration_ms, gen_run_id,
    gen_provider, gen_model, gen_prompt, created_at)
    VALUES ('a1', 'asset', 'video', 'generated', 'managed', 's1', 'Run', '/p/a.mp4', 'a.mp4',
    'video/mp4', 10, 1, 'h', 64, 64, 1000, 'j1', 'comfyui', 'm', 'A run', 'x'),
           ('a2', 'reference', 'image', 'imported', 'linked', NULL, 'Logo', '/p/b.png', 'b.png',
    'image/png', 20, 2, 'g', 4, 4, NULL, NULL, NULL, NULL, NULL, 'y');
  INSERT INTO background_clip (id, variant_id, asset_id, start_ms, in_ms, out_ms, placement)
    VALUES ('k1', 'v1', 'a1', 0, 0, 1000, NULL);
`

const TABLES = ['subject', 'campaign', 'direction', 'variant', 'variant_subject', 'asset']
const NEW_COLUMNS = ['first_clip_made', 'sound', 'sound_asset_id', 'sound_on']

const all = (db: Database, sql: string) => db.prepare(sql).all() as Record<string, unknown>[]
const without = (rows: Record<string, unknown>[]) =>
  rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !NEW_COLUMNS.includes(k))))

function makeFile(name: string, migrations: number): ProjectHandle {
  dir ??= fs.mkdtempSync(path.join(os.tmpdir(), 'adman-0005-'))
  return createProjectFile({
    filePath: path.join(dir, `${name}.adman`),
    name,
    appVersion: '0.1.0',
    now: 'x',
    migrations: bundledMigrations.slice(0, migrations),
  })
}

function upgrade(v5: ProjectHandle): ProjectHandle {
  const filePath = v5.filePath
  closeProjectFile(v5)
  open = openProjectFile({
    filePath,
    appVersion: '0.1.0',
    migrations: bundledMigrations.slice(0, 6),
  })
  return open
}

function upgradedFile(): ProjectHandle {
  const v5 = makeFile('A', 5)
  v5.db.exec(SEED)
  return upgrade(v5)
}

describe('migration 0005 [P7-2, spec/data-rules.md "Data migration"]', () => {
  it('is the sixth migration, after the five before it', () => {
    expect(bundledMigrations.slice(0, 6).map((m) => m.tag)).toEqual([
      '0000_initial',
      '0001_agent_changed_and_job_target',
      '0002_job_started_by_and_error_reason',
      '0003_job_kind_cutout',
      '0004_approvals',
      '0005_video_and_sound',
    ])
  })

  it('upgrades a version 5 file to 6, keeping every row and child row apart from the new fields', () => {
    const v5 = makeFile('A', 5)
    v5.db.exec(SEED)
    const before = [...TABLES, 'background_clip'].map((t) => all(v5.db, `SELECT * FROM ${t}`))
    const h = upgrade(v5)
    expect(readMeta(h.db).schemaVersion).toBe(6)
    const after = [...TABLES, 'background_clip'].map((t) => all(h.db, `SELECT * FROM ${t}`))
    expect(after.map(without)).toEqual(before)
    expect(all(h.db, 'PRAGMA foreign_key_check')).toEqual([])
  })

  it('gives an old variant and an old clip the defaults, and marks a variant with a clip', () => {
    const h = upgradedFile()
    expect(readWireRow(h.db, 'variant', { id: 'v2' })).toMatchObject({
      firstClipMade: false,
      sound: 'clips',
      soundAssetId: null,
    })
    expect(readWireRow(h.db, 'variant', { id: 'v1' })).toMatchObject({
      firstClipMade: true,
      sound: 'clips',
      soundAssetId: null,
    })
    expect(readWireRow(h.db, 'background_clip', { id: 'k1' })).toEqual({
      id: 'k1',
      variantId: 'v1',
      assetId: 'a1',
      startMs: 0,
      inMs: 0,
      outMs: 1000,
      placement: null,
      soundOn: true,
    })
  })

  it('keeps the asset indexes, the other asset checks and the subject link through the rebuild', () => {
    const h = upgradedFile()
    const indexes = all(
      h.db,
      "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'asset' AND sql IS NOT NULL ORDER BY name",
    ).map((r) => r.name)
    expect(indexes).toEqual(['asset_content_hash', 'asset_library_kind', 'asset_subject'])
    const set = (column: string, value: string) =>
      h.db.prepare(`UPDATE asset SET ${column} = ? WHERE id = 'a2'`).run(value)
    expect(() => set('library', 'nope')).toThrow(/CHECK constraint failed/)
    expect(() => set('origin', 'nope')).toThrow(/CHECK constraint failed/)
    expect(() => set('storage', 'nope')).toThrow(/CHECK constraint failed/)
    h.db.exec("DELETE FROM variant_subject; DELETE FROM subject WHERE id = 's1'")
    expect(all(h.db, "SELECT subject_id FROM asset WHERE id = 'a1'")).toEqual([
      { subject_id: null },
    ])
  })

  it.each([
    ['an upgraded file', true],
    ['a new file', false],
  ])('%s accepts audio and refuses midi, and refuses sound loud', (_name, upgraded) => {
    const h = upgraded ? upgradedFile() : (open = makeFile('N', 6))
    if (!upgraded) h.db.exec(SEED)
    const kind = (value: string) =>
      h.db.prepare("UPDATE asset SET kind = ? WHERE id = 'a2'").run(value)
    const sound = (value: string) =>
      h.db.prepare("UPDATE variant SET sound = ? WHERE id = 'v2'").run(value)
    kind('audio')
    expect(() => kind('midi')).toThrow(/CHECK constraint failed/)
    for (const value of ['clips', 'file', 'none']) sound(value)
    expect(() => sound('loud')).toThrow(/CHECK constraint failed/)
  })

  it('refuses a sound_asset_id that names no asset', () => {
    const h = upgradedFile()
    const point = (id: string) =>
      h.db.prepare("UPDATE variant SET sound = 'file', sound_asset_id = ? WHERE id = 'v2'").run(id)
    point('a2')
    expect(() => point('gone')).toThrow(/FOREIGN KEY constraint failed/)
    h.db.pragma('foreign_keys = OFF')
    point('gone')
    expect(all(h.db, 'PRAGMA foreign_key_check')).toEqual([
      { table: 'variant', rowid: expect.any(Number), parent: 'asset', fkid: expect.any(Number) },
    ])
    h.db.pragma('foreign_keys = ON')
  })

  it('changes only variant.first_clip_made in its data step', () => {
    const statements = bundledMigrations[5]?.statements ?? []
    const updates = statements.filter((s) => /^UPDATE/i.test(s))
    expect(updates).toEqual([
      'UPDATE `variant` SET `first_clip_made` = 1 WHERE `id` IN (SELECT `variant_id` FROM `background_clip`);',
    ])
  })
})
