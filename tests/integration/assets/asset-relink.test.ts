import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { assetRelink } from '../../../src/main/commands/asset/relink'
import { makeAssetBus, expectRefused } from './asset-bus'
import { insertTestAsset } from './asset-rows'
import { testLog, type TestLog } from './test-log'

let bus: ReturnType<typeof makeAssetBus>
let log: TestLog
let dir: string
const A = '01JD0000000000000000000001'

// A PNG header for a 300 by 200 picture.
const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 1,
  0x2c, 0, 0, 0, 0xc8, 8, 6, 0, 0, 0,
])
const hashOf = (b: Buffer) => crypto.createHash('sha256').update(b).digest('hex')

beforeEach(() => {
  log = testLog()
  bus = makeAssetBus([assetRelink({ log })])
  dir = path.dirname(bus.project.filePath)
})
afterEach(() => bus.cleanup())

const put = (rel: string, bytes: Buffer | string) => {
  const p = path.join(dir, rel)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, bytes)
  return p
}
const row = (id = A) =>
  bus.db.prepare('SELECT * FROM asset WHERE id = ?').get(id) as Record<string, unknown>
const relink = (newPath: string, relinkSiblings = false, assetId = A) =>
  bus.user('asset.relink', { assetId, newPath, relinkSiblings })
const missingRow = (extra: Record<string, unknown> = {}) =>
  insertTestAsset(bus.db, {
    id: A,
    relPath: path.join('old', 'hero.png'),
    absPath: path.join(dir, 'old', 'hero.png'),
    ...extra,
  })

describe('asset.relink [SPEC 4.2; SPEC 14, Slice A rulings point 3, A3-1; FR-009]', () => {
  it('points a missing asset at the file found again and names the row', async () => {
    missingRow({ contentHash: hashOf(PNG) })
    const file = put(path.join('new', 'hero.png'), PNG)
    const result = await bus.changed(() => relink(file))
    expect(result).toEqual({ ok: true, data: { assetId: A, siblingIds: [] } })
    expect(row()).toMatchObject({
      abs_path: file,
      rel_path: path.join('new', 'hero.png'),
      storage: 'linked',
      content_hash: hashOf(PNG),
    })
  })

  it('accepts other content and takes the new file facts, keeping the rest', async () => {
    missingRow({ library: 'reference', contentHash: 'old-hash' })
    const file = put('newer.png', PNG)
    await relink(file)
    expect(row()).toMatchObject({
      abs_path: file,
      mime: 'image/png',
      byte_size: PNG.length,
      mtime_ms: Math.trunc(fs.statSync(file).mtimeMs),
      content_hash: hashOf(PNG),
      width: 300,
      height: 200,
      display_name: `${A}.png`,
      library: 'reference',
      origin: 'imported',
    })
  })

  it('refuses a file of another kind with relink_kind_mismatch', async () => {
    missingRow({ kind: 'font', mime: 'font/otf' })
    const error = await expectRefused(
      bus,
      () => relink(put('hero.png', PNG)),
      'RULE_VIOLATION',
      'relink_kind_mismatch',
    )
    expect(error.message).toBe('Choose a file of the same kind: font.')
  })

  it('refuses a file of no accepted type with relink_kind_mismatch', async () => {
    missingRow()
    await expectRefused(
      bus,
      () => relink(put('fake.png', 'not a picture')),
      'RULE_VIOLATION',
      'relink_kind_mismatch',
    )
  })

  it('makes a managed asset linked and moves, copies or deletes no file', async () => {
    const managed = put(path.join('P Assets', `${A}.png`), PNG)
    insertTestAsset(bus.db, {
      id: A,
      storage: 'managed',
      relPath: path.join('P Assets', `${A}.png`),
      absPath: managed,
    })
    const other = Buffer.concat([PNG, Buffer.from([7])])
    const file = put('elsewhere.png', other)
    await relink(file)
    expect(row()).toMatchObject({ storage: 'linked', abs_path: file })
    expect(fs.readFileSync(managed)).toEqual(PNG)
    expect(fs.readFileSync(file)).toEqual(other)
    expect(fs.readdirSync(path.join(dir, 'P Assets'))).toEqual([`${A}.png`])
  })
})

describe('asset.relink refusals [SPEC 4.1, 10.1; SPEC 14, Slice A rulings points 3, 6]', () => {
  it('refuses an asset that is not in the project with NOT_FOUND', async () => {
    await expectRefused(bus, () => relink(put('hero.png', PNG)), 'NOT_FOUND')
  })

  it('refuses a path that names nothing with NOT_FOUND', async () => {
    missingRow()
    await expectRefused(bus, () => relink(path.join(dir, 'gone.png')), 'NOT_FOUND')
  })

  it('refuses a folder with INVALID_INPUT', async () => {
    missingRow()
    fs.mkdirSync(path.join(dir, 'pics.png'))
    await expectRefused(bus, () => relink(path.join(dir, 'pics.png')), 'INVALID_INPUT')
  })

  const canLockFiles = process.platform !== 'win32' && process.getuid?.() !== 0
  it.runIf(canLockFiles)(
    'refuses an unreadable file with file_not_readable and logs the code, no path',
    async () => {
      missingRow()
      const locked = put(path.join('hidden-folder', 'locked.png'), PNG)
      fs.chmodSync(locked, 0o000)
      try {
        const error = await expectRefused(
          bus,
          () => relink(locked),
          'RULE_VIOLATION',
          'file_not_readable',
        )
        expect(error.message).toBe('locked.png could not be read.')
      } finally {
        fs.chmodSync(locked, 0o600)
      }
      const warns = log.lines.filter((l) => l.level === 'warn')
      expect(warns).toHaveLength(1)
      expect(warns[0]).toMatchObject({
        name: 'asset.relink',
        context: { reason: 'file_not_readable', code: 'EACCES' },
      })
      expect(JSON.stringify(warns[0])).not.toMatch(/hidden-folder|locked/)
    },
  )
})
