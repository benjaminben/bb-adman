import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { assetRelink } from '../../../src/main/commands/asset/relink'
import { makeAssetBus } from './asset-bus'
import { insertTestAsset } from './asset-rows'
import { testLog } from './test-log'

// A watch on the hashing function: every file it is handed, by its real path.
const hashed = vi.hoisted(() => [] as string[])
vi.mock('../../../src/main/assets/inspect', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../src/main/assets/inspect')>()
  return {
    ...real,
    hashFile: (file: string) => {
      hashed.push(fs.realpathSync(file))
      return real.hashFile(file)
    },
  }
})

let bus: ReturnType<typeof makeAssetBus>
let dir: string
const ID = (n: number) => `01JD000000000000000000000${n}`
const NEW = path.join('moved', 'deep')
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])
const png = (n: number) => Buffer.concat([PNG, Buffer.from([n])])
const hashOf = (b: Buffer) => crypto.createHash('sha256').update(b).digest('hex')

beforeEach(() => {
  hashed.length = 0
  bus = makeAssetBus([assetRelink({ log: testLog() })])
  dir = path.dirname(bus.project.filePath)
  rowAt(1, path.join(dir, 'old', 'hero.png'), png(1))
  put(path.join(NEW, 'hero.png'), png(1))
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
const rowAt = (n: number, abs: string, bytes: Buffer) =>
  insertTestAsset(bus.db, { id: ID(n), relPath: abs, absPath: abs, contentHash: hashOf(bytes) })
const relinkFirst = () =>
  bus.user('asset.relink', {
    assetId: ID(1),
    newPath: path.join(dir, NEW, 'hero.png'),
    relinkSiblings: true,
  })
const outsideNewFolder = () => {
  const newDir = fs.realpathSync(path.join(dir, NEW))
  return hashed.filter((f) => !f.startsWith(`${newDir}${path.sep}`))
}

function canLink(): boolean {
  try {
    fs.symlinkSync(path.join(dir, 'old'), path.join(dir, 'probe'), 'dir')
    fs.unlinkSync(path.join(dir, 'probe'))
    return true
  } catch {
    return false
  }
}

describe('asset.relink siblings are never hashed outside the new folder [SPEC 14 1.30 U7, A3-1] (security class)', () => {
  it('never hashes a candidate outside the new folder', async () => {
    rowAt(2, [dir, 'old', '..', 'outside', 'x.png'].join(path.sep), png(2))
    rowAt(3, path.join(dir, 'old-other', 'y.png'), png(3))
    const x = put(path.join('moved', 'outside', 'x.png'), png(2))
    const y = put(path.join('moved', 'deep-other', 'y.png'), png(3))
    rowAt(4, path.join(dir, 'old', 'b.png'), png(4))
    const b = put(path.join(NEW, 'b.png'), png(4))
    const result = await relinkFirst()
    expect(result).toEqual({ ok: true, data: { assetId: ID(1), siblingIds: [ID(4)] } })
    expect(hashed).toContain(fs.realpathSync(b))
    expect(hashed).not.toContain(fs.realpathSync(x))
    expect(hashed).not.toContain(fs.realpathSync(y))
    expect(outsideNewFolder()).toEqual([])
  })

  it('neither relinks nor hashes a candidate under a linked subfolder of the new folder', async (ctx) => {
    if (!canLink()) ctx.skip()
    const was = path.join(dir, 'old', 'sub', 'b.png')
    rowAt(2, was, png(2))
    const target = put(path.join('elsewhere', 'b.png'), png(2))
    fs.symlinkSync(path.dirname(target), path.join(dir, NEW, 'sub'), 'dir')
    const result = await relinkFirst()
    expect(result).toEqual({ ok: true, data: { assetId: ID(1), siblingIds: [] } })
    expect(absOf(ID(2))).toBe(was)
    expect(hashed).not.toContain(fs.realpathSync(target))
    expect(outsideNewFolder()).toEqual([])
  })
})
