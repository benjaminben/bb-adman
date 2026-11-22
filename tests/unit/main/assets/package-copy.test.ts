// The packaged copy of the open project is opened with trusted_schema off, so a view or
// trigger in that file cannot call an app-defined function while it is rewritten.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openPackageCopy } from '@/main/assets/package'

let dir: string
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

describe('openPackageCopy', () => {
  it('opens the copy with trusted_schema off', () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-package-copy-'))
    const db = openPackageCopy(path.join(dir, 'copy.adman'))
    try {
      expect(db.pragma('trusted_schema', { simple: true })).toBe(0)
    } finally {
      db.close()
    }
  })
})
