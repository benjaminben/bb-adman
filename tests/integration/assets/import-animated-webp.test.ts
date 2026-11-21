import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { assetImport } from '@/main/commands/asset/import'
import { makeAssetBus } from './asset-bus'
import { testLog } from './test-log'
import { chunk, vp8, vp8x, webp } from '../../fixtures/webp-bytes'

let bus: ReturnType<typeof makeAssetBus>
let dir: string

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 1,
  0x2c, 0, 0, 0, 0xc8, 8, 6, 0, 0, 0,
])
const ANIMATED = Buffer.from(webp([...vp8x(20, 10, true), ...chunk('ANIM', [0, 0, 0, 0, 0, 0])]))
const STILL = Buffer.from(webp(vp8(20, 10)))
// An animated WebP larger than the first bytes import reads (256 KB).
const LARGE_ANIMATED = Buffer.from(
  webp([...vp8x(20, 10, true), ...chunk('ANMF', new Array<number>(300 * 1024).fill(7))]),
)
// RIFF and WEBP are there, so the file is accepted, but the first chunk cannot be read.
const BROKEN = Buffer.from(webp(chunk('ALPH', [1, 2, 3])))

beforeEach(() => {
  bus = makeAssetBus([assetImport({ now: () => new Date(), log: testLog() })])
  dir = path.dirname(bus.project.filePath)
})
afterEach(() => bus.cleanup())

const put = (rel: string, bytes: Buffer) => {
  const p = path.join(dir, rel)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, bytes)
  return p
}
type Reply = { assetIds: string[]; reusedAssetIds: string[]; animatedAssetIds: string[] }
const importIt = async (paths: string[], copy = false) => {
  const result = await bus.user('asset.import', { library: 'asset', copy, paths })
  expect(result).toMatchObject({ ok: true })
  return (result as { data: Reply }).data
}

describe('asset.import lists the animated WebP files it imported [S2-17]', () => {
  it('lists an animated WebP, and not a still WebP or a PNG', async () => {
    const paths = [put('in/spin.webp', ANIMATED), put('in/still.webp', STILL), put('in/a.png', PNG)]
    const data = await importIt(paths)
    expect(data.animatedAssetIds).toEqual([data.assetIds[0]])
  })

  it('holds an empty list when no file is animated', async () => {
    const data = await importIt([put('in/still.webp', STILL), put('in/a.png', PNG)])
    expect(data.animatedAssetIds).toEqual([])
  })

  it('lists an animated WebP the project already held, once', async () => {
    const [first] = (await importIt([put('in/spin.webp', ANIMATED)])).assetIds
    const data = await importIt([put('in/again.webp', ANIMATED), put('in/third.webp', ANIMATED)])
    expect(data.reusedAssetIds).toEqual([first])
    expect(data.animatedAssetIds).toEqual([first])
  })

  it('lists an animated WebP larger than the bytes it reads first', async () => {
    const data = await importIt([put('in/large.webp', LARGE_ANIMATED)])
    expect(data.animatedAssetIds).toEqual(data.assetIds)
  })

  it('imports a WebP whose header cannot be read, and does not list it', async () => {
    const data = await importIt([put('in/broken.webp', BROKEN)])
    expect(data.assetIds).toHaveLength(1)
    expect(data.animatedAssetIds).toEqual([])
  })

  it('lists an animated WebP that is copied into the assets folder', async () => {
    const data = await importIt([put('in/spin.webp', ANIMATED)], true)
    expect(data.animatedAssetIds).toEqual(data.assetIds)
  })
})

describe('asset.import of a folder lists its animated WebP files [S2-17]', () => {
  it('lists an animated WebP, and not a still WebP or a PNG', async () => {
    put('pics/a.png', PNG)
    put('pics/sub/spin.webp', ANIMATED)
    put('pics/still.webp', STILL)
    put('pics/sub/large.webp', LARGE_ANIMATED)
    const data = await importIt([path.join(dir, 'pics')])
    const names = new Map(
      (
        bus.db.prepare('SELECT id, display_name FROM asset').all() as Array<{
          id: string
          display_name: string
        }>
      ).map((r) => [r.id, r.display_name]),
    )
    expect(data.animatedAssetIds.map((id) => names.get(id)).sort()).toEqual([
      'large.webp',
      'spin.webp',
    ])
  })
})
