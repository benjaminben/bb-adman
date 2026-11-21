import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { assetRelink } from '@/main/commands/asset/relink'
import { makeAssetBus } from './asset-bus'
import { insertTestAsset } from './asset-rows'
import { testLog } from './test-log'

let bus: ReturnType<typeof makeAssetBus>
let dir: string
const ID = (n: number) => `01JD000000000000000000000${n}`
// The named asset's file moved from old/ to moved/deep/.
const NEW = path.join('moved', 'deep')

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])
const png = (n: number) => Buffer.concat([PNG, Buffer.from([n])])
const hashOf = (b: Buffer) => crypto.createHash('sha256').update(b).digest('hex')

beforeEach(() => {
  bus = makeAssetBus([assetRelink({ log: testLog() })])
  dir = path.dirname(bus.project.filePath)
})
afterEach(() => bus.cleanup())

const put = (rel: string, bytes: Buffer) => {
  const p = path.join(dir, rel)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, bytes)
  return p
}
const absOf = (id: string) =>
  (bus.db.prepare('SELECT abs_path FROM asset WHERE id = ?').get(id) as { abs_path: string })
    .abs_path
// A linked row whose file is at `abs` (which may not exist) and whose hash is that of `bytes`.
const rowAt = (n: number, abs: string, bytes: Buffer) =>
  insertTestAsset(bus.db, { id: ID(n), relPath: abs, absPath: abs, contentHash: hashOf(bytes) })

describe('asset.relink with relinkSiblings [SPEC 14, Slice A rulings point 3, A3-1] (security class)', () => {
  beforeEach(() => {
    rowAt(1, path.join(dir, 'old', 'hero.png'), png(1))
    put(path.join(NEW, 'hero.png'), png(1))
  })
  const relinkFirst = (relinkSiblings: boolean) =>
    bus.user('asset.relink', {
      assetId: ID(1),
      newPath: path.join(dir, NEW, 'hero.png'),
      relinkSiblings,
    })

  it('finds missing siblings at the same relative path under the new folder', async () => {
    rowAt(2, path.join(dir, 'old', 'b.png'), png(2))
    rowAt(3, path.join(dir, 'old', 'sub', 'c.png'), png(3))
    const b = put(path.join(NEW, 'b.png'), png(2))
    const c = put(path.join(NEW, 'sub', 'c.png'), png(3))
    const result = await bus.changed(() => relinkFirst(true))
    expect(result).toEqual({ ok: true, data: { assetId: ID(1), siblingIds: [ID(2), ID(3)] } })
    expect([absOf(ID(2)), absOf(ID(3))]).toEqual([b, c])
  })

  it('leaves a sibling whose file there has other content missing', async () => {
    const was = path.join(dir, 'old', 'b.png')
    rowAt(2, was, png(2))
    put(path.join(NEW, 'b.png'), png(9))
    const result = await relinkFirst(true)
    expect(result).toEqual({ ok: true, data: { assetId: ID(1), siblingIds: [] } })
    expect(absOf(ID(2))).toBe(was)
  })

  it('leaves a sibling that is not missing alone', async () => {
    const there = put(path.join('old', 'b.png'), png(2))
    rowAt(2, there, png(2))
    put(path.join(NEW, 'b.png'), png(2))
    await relinkFirst(true)
    expect(absOf(ID(2))).toBe(there)
  })

  // Built by joining text, so `..` stays in the stored path. A check on the text alone would
  // look for these at moved/outside/x.png and moved/deep-other/y.png, outside moved/deep.
  it('never takes a candidate outside the new folder', async () => {
    const escape = [dir, 'old', '..', 'outside', 'x.png'].join(path.sep)
    rowAt(2, escape, png(2))
    const lookAlike = path.join(dir, 'old-other', 'y.png')
    rowAt(3, lookAlike, png(3))
    put(path.join('moved', 'outside', 'x.png'), png(2))
    put(path.join('moved', 'deep-other', 'y.png'), png(3))
    const result = await relinkFirst(true)
    expect(result).toEqual({ ok: true, data: { assetId: ID(1), siblingIds: [] } })
    expect([absOf(ID(2)), absOf(ID(3))]).toEqual([escape, lookAlike])
  })

  it('relinks no sibling when relinkSiblings is false', async () => {
    const was = path.join(dir, 'old', 'b.png')
    rowAt(2, was, png(2))
    put(path.join(NEW, 'b.png'), png(2))
    const result = await relinkFirst(false)
    expect(result).toEqual({ ok: true, data: { assetId: ID(1), siblingIds: [] } })
    expect(absOf(ID(2))).toBe(was)
  })

  it.runIf(process.platform !== 'win32')('does not follow a link in the new folder', async () => {
    const was = path.join(dir, 'old', 'b.png')
    rowAt(2, was, png(2))
    const target = put(path.join('elsewhere', 'b.png'), png(2))
    fs.symlinkSync(target, path.join(dir, NEW, 'b.png'))
    const result = await relinkFirst(true)
    expect(result).toEqual({ ok: true, data: { assetId: ID(1), siblingIds: [] } })
    expect(absOf(ID(2))).toBe(was)
  })
})
