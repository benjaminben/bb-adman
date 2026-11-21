import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { assetImport } from '@/main/commands/asset/import'
import { assetRelink } from '@/main/commands/asset/relink'
import { assetCheckChanged } from '@/main/commands/asset/check-changed'
import { MAX_FONT_BYTES } from '@/main/assets/font-name'
import { makeAssetBus } from './asset-bus'
import { insertTestAsset } from './asset-rows'
import { testLog } from './test-log'
import { nameTable, sfnt, win, woff2 } from '../../unit/main/assets/font-bytes'

let bus: ReturnType<typeof makeAssetBus>
let dir: string
const A = '01JD0000000000000000000001'
const NOW = new Date('2026-11-20T10:00:00.000Z')

const font = (family: string) => {
  const tables = [{ tag: 'name', data: nameTable([win(1, family)]) }]
  return { ttf: sfnt('ttf', tables), otf: sfnt('otf', tables), woff2: woff2(tables) }
}

beforeEach(() => {
  const log = testLog()
  bus = makeAssetBus([
    assetImport({ now: () => NOW, log }),
    assetRelink({ log }),
    assetCheckChanged({ log }),
  ])
  dir = path.dirname(bus.project.filePath)
})
afterEach(() => bus.cleanup())

const put = (rel: string, bytes: Buffer) => {
  const p = path.join(dir, rel)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, bytes)
  return p
}
const families = () =>
  (
    bus.db
      .prepare('SELECT display_name, font_family FROM asset ORDER BY display_name')
      .all() as Array<{ display_name: string; font_family: string | null }>
  ).map((r) => [r.display_name, r.font_family])
const importIt = (paths: string[], copy = false) =>
  bus.user('asset.import', { library: 'asset', copy, paths })
const familyOf = (id = A) =>
  (bus.db.prepare('SELECT font_family FROM asset WHERE id = ?').get(id) as { font_family: unknown })
    .font_family

describe('font_family at import, relink and the change check [SPEC scene.md, FR-056]', () => {
  it('fills font_family for TTF, OTF and WOFF2 files imported by path, copied or in a folder', async () => {
    const one = put('in/one.ttf', font('One').ttf)
    const two = put('in/two.otf', font('Two').otf)
    put('folder/three.woff2', font('Three').woff2)
    const four = put('in/four.woff2', font('Four').woff2)
    expect((await importIt([one, two, path.join(dir, 'folder')])) as object).toMatchObject({
      ok: true,
    })
    expect((await importIt([four], true)) as object).toMatchObject({ ok: true })
    expect(families()).toEqual([
      ['four.woff2', 'Four'],
      ['one.ttf', 'One'],
      ['three.woff2', 'Three'],
      ['two.otf', 'Two'],
    ])
  })

  it('leaves font_family null for a damaged font, a picture, and a font over the size cap', async () => {
    const damaged = font('Bad').ttf
    damaged.writeUInt32BE(0xfffffff0, 12 + 8)
    const big = Buffer.concat([font('Big').ttf, Buffer.alloc(MAX_FONT_BYTES)])
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000', 'hex')
    const files = [put('bad.ttf', damaged), put('big.ttf', big), put('pic.png', png)]
    expect((await importIt(files)) as object).toMatchObject({ ok: true })
    expect(families()).toEqual([
      ['bad.ttf', null],
      ['big.ttf', null],
      ['pic.png', null],
    ])
  })

  it('fills font_family when a font is relinked', async () => {
    const bytes = font('Moved').woff2
    insertTestAsset(bus.db, {
      id: A,
      kind: 'font',
      mime: 'font/woff2',
      relPath: 'old/moved.woff2',
      absPath: path.join(dir, 'old', 'moved.woff2'),
    })
    const file = put('new/moved.woff2', bytes)
    const result = await bus.user('asset.relink', {
      assetId: A,
      newPath: file,
      relinkSiblings: false,
    })
    expect(result as object).toMatchObject({ ok: true })
    expect(familyOf()).toBe('Moved')
  })

  it('fills font_family again when a linked font changes on disk, and clears it for another kind', async () => {
    const file = put('brand.ttf', font('Old').ttf)
    insertTestAsset(bus.db, {
      id: A,
      kind: 'font',
      mime: 'font/ttf',
      relPath: 'brand.ttf',
      absPath: file,
    })
    fs.writeFileSync(file, font('New Brand').ttf)
    expect((await bus.user('asset.checkChanged', {})) as object).toMatchObject({ ok: true })
    expect(familyOf()).toBe('New Brand')
    fs.writeFileSync(file, Buffer.from('not a font any more'))
    expect((await bus.user('asset.checkChanged', {})) as object).toMatchObject({ ok: true })
    expect(familyOf()).toBeNull()
  })
})
