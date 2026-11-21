import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { assetCheckChanged } from '@/main/commands/asset/check-changed'
import { makeAssetBus } from './asset-bus'
import { insertTestAsset, type TestAsset } from './asset-rows'
import { testLog, type TestLog } from './test-log'

let bus: ReturnType<typeof makeAssetBus>
let log: TestLog
let dir: string
const A = '01JD0000000000000000000001'

// A PNG header for a 300 by 200 picture, and the start of a JPEG.
const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 1,
  0x2c, 0, 0, 0, 0xc8, 8, 6, 0, 0, 0,
])
const hashOf = (b: Buffer | string) => crypto.createHash('sha256').update(b).digest('hex')

beforeEach(() => {
  log = testLog()
  bus = makeAssetBus([assetCheckChanged({ log })])
  dir = path.dirname(bus.project.filePath)
})
afterEach(() => bus.cleanup())

const put = (name: string, bytes: Buffer | string) => {
  const p = path.join(dir, name)
  fs.writeFileSync(p, bytes)
  return p
}
// A row for the file at `name`, stored with size 1 and time 1 unless `same` makes them match.
const rowFor = (name: string, extra: Partial<TestAsset> = {}, same = false) => {
  const abs = path.join(dir, name)
  insertTestAsset(bus.db, { id: A, relPath: name, absPath: abs, ...extra })
  bus.db.prepare('UPDATE asset SET width = 5, height = 5 WHERE id = ?').run(A)
  if (same) {
    const stat = fs.statSync(abs)
    bus.db
      .prepare('UPDATE asset SET byte_size = ?, mtime_ms = ? WHERE id = ?')
      .run(stat.size, Math.trunc(stat.mtimeMs), A)
  }
}
const row = () =>
  bus.db.prepare('SELECT * FROM asset WHERE id = ?').get(A) as Record<string, unknown>
const check = () => bus.user('asset.checkChanged', {})
const factsOf = (file: string) => {
  const stat = fs.statSync(file)
  return { byte_size: stat.size, mtime_ms: Math.trunc(stat.mtimeMs) }
}

describe('asset.checkChanged [SPEC 14, Slice A rulings point 2b, A3-4; FR-009, R-06]', () => {
  it('is a system command no window may send', () => {
    expect(assetCheckChanged({ log }).internal).toBe(true)
  })

  it('updates only size and time when the content is the same', async () => {
    const file = put('a.png', PNG)
    rowFor('a.png', { contentHash: hashOf(PNG) })
    const result = await bus.changed(() => check())
    expect(result).toEqual({ ok: true, data: { assetIds: [] } })
    expect(row()).toMatchObject({ ...factsOf(file), content_hash: hashOf(PNG), width: 5 })
  })

  it('takes the new facts when the content changed and is the same kind', async () => {
    const file = put('a.png', PNG)
    rowFor('a.png', { contentHash: 'old' })
    const result = await bus.changed(() => check())
    expect(result).toEqual({ ok: true, data: { assetIds: [A] } })
    expect(row()).toMatchObject({
      ...factsOf(file),
      kind: 'image',
      mime: 'image/png',
      content_hash: hashOf(PNG),
      width: 300,
      height: 200,
    })
    const infos = log.lines.filter((l) => l.level === 'info')
    expect(infos).toHaveLength(1)
    expect(JSON.stringify(infos[0])).toContain(A)
    expect(JSON.stringify(infos[0])).not.toContain(dir)
  })

  it('keeps kind and mime, clears the pixel size and warns when the bytes are another kind', async () => {
    const file = put('a.png', 'now it is text')
    rowFor('a.png', { contentHash: 'old' })
    const result = await bus.changed(() => check())
    expect(result).toEqual({ ok: true, data: { assetIds: [A] } })
    expect(row()).toMatchObject({
      ...factsOf(file),
      kind: 'image',
      mime: 'image/png',
      content_hash: hashOf('now it is text'),
      width: null,
      height: null,
    })
    const warns = log.lines.filter((l) => l.level === 'warn')
    expect(warns).toHaveLength(1)
    expect(JSON.stringify(warns[0])).toContain(A)
    expect(JSON.stringify(warns[0])).not.toContain(dir)
  })

  it('reads no file whose size and time match the row', async () => {
    put('a.png', PNG)
    rowFor('a.png', { contentHash: 'old' }, true)
    const result = await bus.changed(() => check())
    expect(result).toEqual({ ok: true, data: { assetIds: [] } })
    expect(row()).toMatchObject({ content_hash: 'old' })
  })

  it('skips a missing file and a managed file', async () => {
    insertTestAsset(bus.db, { id: A, relPath: 'gone.png', absPath: path.join(dir, 'gone.png') })
    const B = '01JD0000000000000000000002'
    put('m.png', PNG)
    insertTestAsset(bus.db, {
      id: B,
      storage: 'managed',
      relPath: 'm.png',
      absPath: path.join(dir, 'm.png'),
      contentHash: 'old',
    })
    const result = await bus.changed(() => check())
    expect(result).toEqual({ ok: true, data: { assetIds: [] } })
    expect(bus.db.prepare('SELECT content_hash FROM asset WHERE id = ?').get(B)).toEqual({
      content_hash: 'old',
    })
  })
})
