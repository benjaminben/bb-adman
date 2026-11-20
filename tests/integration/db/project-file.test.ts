import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import Database from 'better-sqlite3'
import {
  createProjectFile,
  openProjectFile,
  closeProjectFile,
} from '../../../src/main/db/project-file'
import { bundledMigrations } from '../../../src/main/db/bundled-migrations'
import { AppError } from '../../../src/shared/schemas/result'

const SPEC_TABLES = [
  'asset',
  'background_clip',
  'campaign',
  'campaign_subject',
  'direction',
  'job',
  'layer',
  'project_meta',
  'report',
  'rule_set',
  'subject',
  'variant',
  'variant_check',
  'variant_subject',
]
const NOW = '2026-11-20T10:00:00.000Z'

let dir: string
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-pf-'))
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

function errorCode(fn: () => unknown): string {
  try {
    fn()
  } catch (e) {
    if (e instanceof AppError) return e.code
    throw e
  }
  throw new Error('expected an AppError')
}

describe('project file schema [SPEC 3.3]', () => {
  it('creates every table in Section 3.3', () => {
    const file = path.join(dir, 'Summer.adman')
    const h = createProjectFile({ filePath: file, name: 'Summer', appVersion: '0.1.0', now: NOW })
    const rows = h.db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as Array<{ name: string }>
    expect(rows.map((r) => r.name)).toEqual(SPEC_TABLES)
    closeProjectFile(h)
  })

  it('writes the project_meta keys', () => {
    const file = path.join(dir, 'Summer.adman')
    const h = createProjectFile({ filePath: file, name: 'Summer', appVersion: '0.1.0', now: NOW })
    expect(h.meta).toMatchObject({
      name: 'Summer',
      schemaVersion: bundledMigrations.length,
      createdAppVersion: '0.1.0',
      assetsDirRel: 'Summer Assets',
      assetsDirAbs: path.join(dir, 'Summer Assets'),
      createdAt: NOW,
    })
    expect(h.meta.projectId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/)
    closeProjectFile(h)
  })

  it('enforces the variant_grid unique index and layer check constraints', () => {
    const h = createProjectFile({
      filePath: path.join(dir, 'A.adman'),
      name: 'A',
      appVersion: '0.1.0',
      now: NOW,
    })
    const idx = h.db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name IN ('variant_grid','layer_variant','clip_variant','job_status')",
      )
      .all()
    expect(idx).toHaveLength(4)
    expect(() =>
      h.db.prepare("INSERT INTO subject (id, name, created_at) VALUES ('s', 'S', 'x')").run(),
    ).not.toThrow()
    expect(() =>
      h.db
        .prepare(
          "INSERT INTO asset (id, library, kind, origin, storage, display_name, abs_path, rel_path, mime, byte_size, mtime_ms, content_hash, created_at) VALUES ('a','bogus','image','imported','linked','n','/a','a','image/png',1,1,'h','x')",
        )
        .run(),
    ).toThrow(/CHECK/)
    closeProjectFile(h)
  })
})

describe('project file open settings [SPEC 3.1]', () => {
  it('applies journal_mode DELETE, synchronous FULL, foreign_keys ON and locking_mode EXCLUSIVE', () => {
    const h = createProjectFile({
      filePath: path.join(dir, 'A.adman'),
      name: 'A',
      appVersion: '0.1.0',
      now: NOW,
    })
    expect(h.db.pragma('journal_mode', { simple: true })).toBe('delete')
    expect(h.db.pragma('synchronous', { simple: true })).toBe(2)
    expect(h.db.pragma('foreign_keys', { simple: true })).toBe(1)
    expect(h.db.pragma('locking_mode', { simple: true })).toBe('exclusive')
    closeProjectFile(h)
  })

  it('refuses a second open of the same file with PROJECT_LOCKED while it is open', () => {
    const file = path.join(dir, 'A.adman')
    const h = createProjectFile({ filePath: file, name: 'A', appVersion: '0.1.0', now: NOW })
    expect(errorCode(() => openProjectFile({ filePath: file, appVersion: '0.1.0' }))).toBe(
      'PROJECT_LOCKED',
    )
    closeProjectFile(h)
  })

  it('leaves exactly one file when closed, and it reopens', () => {
    const file = path.join(dir, 'A.adman')
    const h = createProjectFile({ filePath: file, name: 'A', appVersion: '0.1.0', now: NOW })
    const projectId = h.meta.projectId
    closeProjectFile(h)
    expect(fs.readdirSync(dir)).toEqual(['A.adman'])
    const again = openProjectFile({ filePath: file, appVersion: '0.1.0' })
    expect(again.meta.projectId).toBe(projectId)
    closeProjectFile(again)
  })

  it('refuses to create over an existing file', () => {
    const file = path.join(dir, 'A.adman')
    fs.writeFileSync(file, 'x')
    expect(
      errorCode(() =>
        createProjectFile({ filePath: file, name: 'A', appVersion: '0.1.0', now: NOW }),
      ),
    ).toBe('RULE_VIOLATION')
    expect(fs.readFileSync(file, 'utf8')).toBe('x')
  })

  it('returns NOT_FOUND for a missing file and INVALID_INPUT for a file that is not a project', () => {
    expect(
      errorCode(() =>
        openProjectFile({ filePath: path.join(dir, 'none.adman'), appVersion: '0.1.0' }),
      ),
    ).toBe('NOT_FOUND')
    const other = path.join(dir, 'other.adman')
    fs.writeFileSync(other, 'not a database at all, just some text')
    expect(errorCode(() => openProjectFile({ filePath: other, appVersion: '0.1.0' }))).toBe(
      'INVALID_INPUT',
    )
  })
})

describe('project file versions [SPEC 3.8]', () => {
  it('refuses a file made by a newer version with the plain message', () => {
    const file = path.join(dir, 'A.adman')
    closeProjectFile(
      createProjectFile({ filePath: file, name: 'A', appVersion: '0.1.0', now: NOW }),
    )
    const raw = new Database(file)
    raw.prepare("UPDATE project_meta SET value = '999' WHERE key = 'schema_version'").run()
    raw.close()
    try {
      openProjectFile({ filePath: file, appVersion: '0.1.0' })
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(AppError)
      expect((e as AppError).message).toBe(
        'This project was made with a newer version of the app. Download the latest version to open it.',
      )
    }
    expect(fs.readdirSync(dir)).toEqual(['A.adman'])
  })

  it('backs up an older file to Name.adman.bak, migrates it and updates schema_version', () => {
    const file = path.join(dir, 'A.adman')
    const v1 = bundledMigrations
    closeProjectFile(
      createProjectFile({
        filePath: file,
        name: 'A',
        appVersion: '0.1.0',
        now: NOW,
        migrations: v1,
      }),
    )
    const v2 = [
      ...v1,
      { tag: '9999_test', statements: ['CREATE TABLE extra_test (id TEXT PRIMARY KEY)'] },
    ]
    const h = openProjectFile({ filePath: file, appVersion: '0.2.0', migrations: v2 })
    expect(h.meta.schemaVersion).toBe(v2.length)
    expect(
      h.db.prepare("SELECT name FROM sqlite_master WHERE name = 'extra_test'").get(),
    ).toBeTruthy()
    closeProjectFile(h)
    const bak = new Database(path.join(dir, 'A.adman.bak'), { readonly: true })
    const version = bak
      .prepare("SELECT value FROM project_meta WHERE key = 'schema_version'")
      .get() as { value: string }
    expect(Number(version.value)).toBe(v1.length)
    bak.close()
  })

  it('rolls back every migration step when one fails, leaving the file at its old version', () => {
    const file = path.join(dir, 'A.adman')
    const v1 = bundledMigrations
    closeProjectFile(
      createProjectFile({
        filePath: file,
        name: 'A',
        appVersion: '0.1.0',
        now: NOW,
        migrations: v1,
      }),
    )
    const bad = [
      ...v1,
      { tag: '9999_bad', statements: ['CREATE TABLE ok_test (id TEXT)', 'NOT VALID SQL'] },
    ]
    expect(() =>
      openProjectFile({ filePath: file, appVersion: '0.2.0', migrations: bad }),
    ).toThrow()
    const h = openProjectFile({ filePath: file, appVersion: '0.1.0', migrations: v1 })
    expect(h.meta.schemaVersion).toBe(v1.length)
    expect(
      h.db.prepare("SELECT name FROM sqlite_master WHERE name = 'ok_test'").get(),
    ).toBeUndefined()
    closeProjectFile(h)
  })
})
