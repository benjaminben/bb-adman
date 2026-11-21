import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { closeProjectFile, createProjectFile, openProjectFile } from '@/main/db/project-file'

let dir: string
let file: string
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-version-'))
  file = path.join(dir, 'A.adman')
  closeProjectFile(createProjectFile({ filePath: file, name: 'A', appVersion: '0.1.0', now: 'x' }))
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

// Sets and reads the stored version by plain SQL, as a hostile project file could hold it.
const setVersion = (value: string) => {
  const raw = new Database(file)
  raw.prepare("UPDATE project_meta SET value = ? WHERE key = 'schema_version'").run(value)
  raw.close()
}
const storedVersion = () => {
  const raw = new Database(file, { readonly: true })
  const row = raw.prepare("SELECT value FROM project_meta WHERE key = 'schema_version'").get() as {
    value: string
  }
  raw.close()
  return row.value
}
const open = () => openProjectFile({ filePath: file, appVersion: '0.1.0' })

describe('schema_version is digits only [SPEC 14 1.34 V4]', () => {
  for (const value of ['-1', '', '1e0', ' 1']) {
    it(`refuses a stored version of ${JSON.stringify(value)} with not_a_project`, () => {
      setVersion(value)
      expect(open).toThrow(expect.objectContaining({ details: { reason: 'not_a_project' } }))
      expect(fs.existsSync(`${file}.bak`)).toBe(false)
      expect(storedVersion()).toBe(value)
    })
  }

  it('still opens a file the app made', () => {
    const project = open()
    closeProjectFile(project)
    expect(fs.existsSync(`${file}.bak`)).toBe(false)
  })
})
