import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  closeProjectFile,
  createProjectFile,
  openProjectFile,
} from '../../../src/main/db/project-file'
import { bundledMigrations } from '../../../src/main/db/bundled-migrations'
import { readMeta } from '../../../src/main/db/meta'

const NOW = '2026-11-20T10:00:00.000Z'
const v1 = bundledMigrations
const v2 = [
  ...v1,
  { tag: '9999_test', statements: ['CREATE TABLE extra_test (id TEXT PRIMARY KEY)'] },
]

let dir: string
let file: string
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-oldname-'))
  file = path.join(dir, 'A.adman')
  closeProjectFile(
    createProjectFile({ filePath: file, name: 'A', appVersion: '0.1.0', now: NOW, migrations: v1 }),
  )
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

// Changes the stored file by plain SQL, as a hostile project file could hold it.
const edit = (sql: string, ...params: string[]) => {
  const raw = new Database(file)
  raw.prepare(sql).run(...params)
  raw.close()
}
const storedVersion = () => {
  const raw = new Database(file, { readonly: true })
  const row = raw.prepare("SELECT value FROM project_meta WHERE key = 'schema_version'").get() as {
    value: string
  }
  raw.close()
  return Number(row.value)
}
const openV2 = () => openProjectFile({ filePath: file, appVersion: '0.2.0', migrations: v2 })

describe('an older project file: the name is checked before the backup [SPEC 14 1.32 U11]', () => {
  const refusals: Array<[string, () => void]> = [
    [
      'whose name is ../../x',
      () => edit("UPDATE project_meta SET value = ? WHERE key = 'name'", '../../x'),
    ],
    ['with no name row', () => edit("DELETE FROM project_meta WHERE key = 'name'")],
  ]
  for (const [label, spoil] of refusals) {
    it(`refuses a file ${label} with not_a_project, writes no .bak and leaves the version`, () => {
      spoil()
      expect(openV2).toThrow(expect.objectContaining({ details: { reason: 'not_a_project' } }))
      expect(fs.existsSync(`${file}.bak`)).toBe(false)
      expect(storedVersion()).toBe(v1.length)
    })
  }

  it('still backs up and migrates a good older file', () => {
    const h = openV2()
    expect(readMeta(h.db).schemaVersion).toBe(v2.length)
    closeProjectFile(h)
    expect(fs.existsSync(`${file}.bak`)).toBe(true)
  })
})
