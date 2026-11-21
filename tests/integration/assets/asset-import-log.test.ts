import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { assetImport } from '@/main/commands/asset/import'
import { makeAssetBus } from './asset-bus'
import { testLog, type TestLog } from './test-log'

let bus: ReturnType<typeof makeAssetBus>
let log: TestLog

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])

beforeEach(() => {
  log = testLog()
  bus = makeAssetBus([assetImport({ now: () => new Date(), log })])
})
afterEach(() => bus.cleanup())

// Where the platform cannot take the read permission away, there is nothing to test.
const canLockFiles = process.platform !== 'win32' && process.getuid?.() !== 0

describe('asset.import logs the error code of an unreadable file [SPEC 14, 1.27 A3-7]', () => {
  it.runIf(canLockFiles)('writes one warn line with the code and no part of the path', async () => {
    const dir = path.join(path.dirname(bus.project.filePath), 'secret-folder')
    fs.mkdirSync(dir)
    const locked = path.join(dir, 'locked-name.png')
    fs.writeFileSync(locked, PNG)
    fs.chmodSync(locked, 0o000)
    try {
      const result = await bus.user('asset.import', {
        paths: [locked],
        library: 'asset',
        copy: false,
      })
      expect(result).toMatchObject({
        ok: false,
        error: { details: { reason: 'file_not_readable' } },
      })
    } finally {
      fs.chmodSync(locked, 0o600)
    }
    const warns = log.lines.filter((l) => l.level === 'warn')
    expect(warns).toHaveLength(1)
    expect(warns[0]).toMatchObject({
      name: 'asset.import',
      context: { reason: 'file_not_readable', code: 'EACCES' },
    })
    const text = JSON.stringify(warns[0])
    for (const part of ['secret-folder', 'locked-name', bus.project.filePath]) {
      expect(text).not.toContain(part)
    }
  })
})
