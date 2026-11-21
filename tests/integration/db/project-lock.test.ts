import { describe, it, expect, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawnSync } from 'node:child_process'
import { createProjectFile, closeProjectFile } from '@/main/db/project-file'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-lock-'))
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

// A second process stands in for a second copy of the app [SPEC 3.1, A-02].
function tryLockFromOtherProcess(file: string): string {
  const script = `
    const Database = require('better-sqlite3')
    const db = new Database(process.argv[1], { fileMustExist: true, timeout: 0 })
    try { db.pragma('locking_mode = EXCLUSIVE'); db.exec('BEGIN EXCLUSIVE'); db.exec('COMMIT'); console.log('LOCKED_OK') }
    catch (e) { console.log(e.code) }
  `
  const out = spawnSync(process.execPath, ['-e', script, file], {
    cwd: process.cwd(),
    encoding: 'utf8',
  })
  return out.stdout.trim()
}

describe('exclusive lock across processes [SPEC 3.1]', () => {
  it('stops another process from opening the project until it is closed', () => {
    const file = path.join(dir, 'A.adman')
    const h = createProjectFile({ filePath: file, name: 'A', appVersion: '0.1.0', now: 'x' })
    expect(tryLockFromOtherProcess(file)).toMatch(/^SQLITE_BUSY/)
    closeProjectFile(h)
    expect(tryLockFromOtherProcess(file)).toBe('LOCKED_OK')
  })
})
