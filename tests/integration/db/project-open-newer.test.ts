import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  closeProjectFile,
  createProjectFile,
  openProjectFile,
  NEWER_VERSION_MESSAGE,
} from '@/main/db/project-file'
import { bundledMigrations } from '@/main/db/bundled-migrations'

// LP-11 follow-up: a file newer than the app is refused before any write, so refusing it
// leaves its bytes as they were, in either journal mode.
const NEWER = {
  code: 'RULE_VIOLATION',
  message: NEWER_VERSION_MESSAGE,
  details: { reason: 'newer_version' },
}

let dir: string
let file: string
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-newer-'))
  file = path.join(dir, 'A.adman')
  closeProjectFile(createProjectFile({ filePath: file, name: 'A', appVersion: '0.1.0', now: 'x' }))
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

function makeNewer(journalMode: 'WAL' | 'DELETE') {
  const raw = new Database(file)
  raw.pragma(`journal_mode = ${journalMode}`)
  raw
    .prepare("UPDATE project_meta SET value = ? WHERE key = 'schema_version'")
    .run(String(bundledMigrations.length + 1))
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

describe('a newer project file is refused before any write [LP-11]', () => {
  for (const mode of ['WAL', 'DELETE'] as const) {
    it(`refuses a newer file in ${mode} journal mode, leaving its bytes and folder as they were`, () => {
      makeNewer(mode)
      const before = fs.readFileSync(file)
      expect(fs.readdirSync(dir)).toEqual(['A.adman'])
      expect(refusal()).toMatchObject(NEWER)
      expect(fs.readFileSync(file).equals(before)).toBe(true)
      expect(fs.readdirSync(dir)).toEqual(['A.adman'])
    })
  }

  it('releases the lock: another connection can take it right after the refusal', () => {
    makeNewer('WAL')
    expect(refusal()).toMatchObject(NEWER)
    const other = new Database(file, { timeout: 0 })
    try {
      other.pragma('locking_mode = EXCLUSIVE')
      expect(() => other.exec('BEGIN EXCLUSIVE; COMMIT')).not.toThrow()
    } finally {
      other.close()
    }
  })
})
