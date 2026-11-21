import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { assetImport } from '../../../src/main/commands/asset/import'
import { makeAssetBus } from './asset-bus'
import { testLog } from './test-log'

let bus: ReturnType<typeof makeAssetBus>
let dir: string
let pics: string

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])
const png = (n: number) => Buffer.concat([PNG, Buffer.from(String(n))])

beforeEach(() => {
  bus = makeAssetBus([assetImport({ now: () => new Date(), log: testLog() })])
  dir = path.dirname(bus.project.filePath)
  pics = path.join(dir, 'pics')
})
afterEach(() => {
  vi.restoreAllMocks()
  bus.cleanup()
})

const put = (rel: string, bytes: Buffer | string) => {
  const p = path.join(dir, rel)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, bytes)
  return p
}
const importIt = (paths: string[]) =>
  bus.user('asset.import', { library: 'asset', copy: false, paths })
type Reply = { assetIds: string[]; skippedCount: number }
const dataOf = (r: unknown) => {
  expect(r).toMatchObject({ ok: true })
  return (r as { data: Reply }).data
}
const names = () =>
  (
    bus.db.prepare('SELECT display_name FROM asset ORDER BY rowid').all() as Array<{
      display_name: string
    }>
  ).map((r) => r.display_name)

// Every path the import opens, lists, reads or follows, from the calls the code can make.
function watchPaths(): string[] {
  const seen: string[] = []
  const note = (p: unknown) => {
    if (typeof p === 'string') seen.push(p)
  }
  for (const name of ['open', 'readdir', 'opendir', 'stat', 'realpath', 'readFile'] as const) {
    const real = fs.promises[name] as (...a: unknown[]) => unknown
    vi.spyOn(fs.promises, name).mockImplementation(((p: unknown, ...rest: unknown[]) => {
      note(p)
      return real.call(fs.promises, p, ...rest)
    }) as never)
  }
  const stream = fs.createReadStream
  vi.spyOn(fs, 'createReadStream').mockImplementation(((p: unknown, ...rest: unknown[]) => {
    note(p)
    return stream.call(fs, p as string, ...(rest as []))
  }) as never)
  return seen
}

const inside = (root: string, p: string) => p === root || p.startsWith(root + path.sep)

// Where the platform cannot make a link, there is nothing to test.
const canLink = process.platform !== 'win32'

describe('asset.import does not follow links inside a folder [SPEC 14, Slice A rulings point 5, A3-3]', () => {
  it.runIf(canLink)('skips a link to a file outside the folder and never opens it', async () => {
    put('pics/good.png', png(1))
    const target = put('outside/secret.png', png(2))
    fs.symlinkSync(target, path.join(pics, 'link.png'))
    const seen = watchPaths()
    const data = dataOf(await importIt([pics]))
    expect(names()).toEqual(['good.png'])
    expect(data.skippedCount).toBe(1)
    expect(seen).not.toContain(target)
    expect(seen).not.toContain(path.join(pics, 'link.png'))
  })

  it.runIf(canLink)('skips a link to a folder and never lists it', async () => {
    put('pics/good.png', png(1))
    const target = path.join(dir, 'outside')
    put('outside/secret.png', png(2))
    fs.symlinkSync(target, path.join(pics, 'more'))
    const seen = watchPaths()
    const data = dataOf(await importIt([pics]))
    expect(names()).toEqual(['good.png'])
    expect(data.skippedCount).toBe(1)
    expect(seen.filter((p) => inside(target, p) || inside(path.join(pics, 'more'), p))).toEqual([])
  })

  it.runIf(canLink)(
    'skips a link back to the folder itself, so a loop is never walked',
    async () => {
      put('pics/good.png', png(1))
      fs.symlinkSync(pics, path.join(pics, 'loop'))
      fs.symlinkSync('..', path.join(pics, 'up'))
      const data = dataOf(await importIt([pics]))
      expect(names()).toEqual(['good.png'])
      expect(data.skippedCount).toBe(2)
    },
  )

  it.runIf(canLink)('reads nothing outside the named folder', async () => {
    put('pics/good.png', png(1))
    put('pics/sub/fake.png', 'not a picture')
    put('outside/secret.png', png(2))
    fs.symlinkSync(path.join(dir, 'outside'), path.join(pics, 'sub', 'more'))
    fs.symlinkSync(path.join(dir, 'outside', 'secret.png'), path.join(pics, 'secret.png'))
    const seen = watchPaths()
    dataOf(await importIt([pics]))
    expect(seen.length).toBeGreaterThan(0)
    // Where each path really leads, so a followed link counts as outside.
    const real = fs.realpathSync(pics)
    expect(seen.map((p) => fs.realpathSync(p)).filter((p) => !inside(real, p))).toEqual([])
  })

  it.runIf(canLink)('follows a link the user named directly', async () => {
    const target = put('outside/hero.png', png(1))
    const link = path.join(dir, 'hero-link.png')
    fs.symlinkSync(target, link)
    dataOf(await importIt([link]))
    expect(names()).toEqual(['hero-link.png'])
  })
})
