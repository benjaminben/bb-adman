import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { assetImport } from '../../../src/main/commands/asset/import'
import { makeAssetBus, expectRefused } from './asset-bus'
import { testLog } from './test-log'

let bus: ReturnType<typeof makeAssetBus>
let dir: string

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])
// A different picture each time, so each file is its own asset.
const png = (n: number) => Buffer.concat([PNG, Buffer.from(String(n))])

beforeEach(() => {
  bus = makeAssetBus([assetImport({ now: () => new Date(), log: testLog() })])
  dir = path.dirname(bus.project.filePath)
  bus.db
    .prepare("INSERT INTO subject (id, name, created_at) VALUES ('bottle', 'Bottle', 'x')")
    .run()
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
const importIt = (paths: string[], extra: Record<string, unknown> = {}) =>
  bus.user('asset.import', { library: 'asset', copy: false, paths, ...extra })
type Reply = { assetIds: string[]; reusedAssetIds: string[]; skippedCount: number }
const dataOf = (r: unknown) => {
  expect(r).toMatchObject({ ok: true })
  return (r as { data: Reply }).data
}
const namesOf = (ids: string[]) =>
  ids.map(
    (id) =>
      (
        bus.db.prepare('SELECT display_name FROM asset WHERE id = ?').get(id) as {
          display_name: string
        }
      ).display_name,
  )
const rowCount = () => (bus.db.prepare('SELECT COUNT(*) AS n FROM asset').get() as { n: number }).n

describe('asset.import of a folder [SPEC 14, Slice A rulings point 5, A3-3; FR-050]', () => {
  it('imports the files of a folder and of its subfolders', async () => {
    put('pics/a.png', png(1))
    put('pics/sub/b.png', png(2))
    put('pics/sub/deeper/c.txt', 'Summer sale')
    const result = await bus.changed(() => importIt([path.join(dir, 'pics')]))
    const data = dataOf(result)
    expect(namesOf(data.assetIds)).toEqual(['a.png', 'b.png', 'c.txt'])
    expect(data).toMatchObject({ reusedAssetIds: [], skippedCount: 0 })
  })

  it('keeps paths in input order and sorts a folder by relative path, by code point', async () => {
    const first = put('first.png', png(0))
    put('pics/b.png', png(1))
    put('pics/a/z.png', png(2))
    put('pics/C.png', png(3))
    put('pics/é.png', png(4))
    put('pics/a b.png', png(5))
    const data = dataOf(await importIt([first, path.join(dir, 'pics')]))
    expect(namesOf(data.assetIds)).toEqual([
      'first.png',
      'C.png',
      'a b.png',
      'z.png',
      'b.png',
      'é.png',
    ])
  })

  it('enters 12 levels below the named folder and not the 13th', async () => {
    const levels = (n: number) => Array.from({ length: n }, (_, i) => `l${i + 1}`)
    put(path.join('pics', ...levels(12), 'twelve.png'), png(8))
    put(path.join('pics', ...levels(13), 'thirteen.png'), png(9))
    const data = dataOf(await importIt([path.join(dir, 'pics')]))
    expect(namesOf(data.assetIds)).toEqual(['twelve.png'])
    expect(data.skippedCount).toBe(1)
  })

  it('refuses 501 files with too_many_files and imports nothing', async () => {
    for (let i = 0; i < 500; i++) put(`pics/${i}.txt`, `copy ${i}`)
    const extra = put('extra.txt', 'one more')
    const error = await expectRefused(
      bus,
      () => importIt([path.join(dir, 'pics'), extra]),
      'INVALID_INPUT',
      'too_many_files',
    )
    expect(error.message).toBe('That is too many files for one import. The limit is 500.')
  })

  it('imports exactly 500 files', async () => {
    for (let i = 0; i < 500; i++) put(`pics/${i}.txt`, `copy ${i}`)
    expect(dataOf(await importIt([path.join(dir, 'pics')])).assetIds).toHaveLength(500)
  })
})

describe('asset.import skips entries inside a folder [SPEC 14, Slice A rulings point 5, A3-3]', () => {
  it('skips and counts dot files, dot folders, wrong types and empty files', async () => {
    put('pics/good.png', png(1))
    put('pics/.hidden.png', png(2))
    put('pics/.cache/inside.png', png(3))
    put('pics/fake.png', 'not a picture')
    put('pics/notes.doc', 'no accepted type')
    put('pics/empty.png', '')
    const data = dataOf(await importIt([path.join(dir, 'pics')]))
    expect(namesOf(data.assetIds)).toEqual(['good.png'])
    expect(data.skippedCount).toBe(5)
  })

  it('decides the type from the first bytes and hashes only the files it imports', async () => {
    put('pics/good.png', png(1))
    put('pics/fake.png', 'x'.repeat(100_000))
    put('pics/empty.png', '')
    const createHash = vi.spyOn(crypto, 'createHash')
    dataOf(await importIt([path.join(dir, 'pics')]))
    expect(createHash).toHaveBeenCalledTimes(1)
  })

  it('still refuses a directly named file of the wrong type', async () => {
    put('pics/good.png', png(1))
    const fake = put('fake.png', 'not a picture')
    const error = await expectRefused(
      bus,
      () => importIt([path.join(dir, 'pics'), fake]),
      'INVALID_INPUT',
    )
    expect(error.message).toBe('fake.png is not a file type the app accepts.')
  })
})

describe('asset.import of a folder reusing content [SPEC 14, Slice A rulings point 5; FR-053]', () => {
  it('adds one row for the same content twice and names the asset twice', async () => {
    put('pics/a.png', png(1))
    put('pics/b.png', png(1))
    const data = dataOf(await importIt([path.join(dir, 'pics')]))
    expect(data.assetIds[0]).toBe(data.assetIds[1])
    expect(data.reusedAssetIds).toEqual([])
    expect(rowCount()).toBe(1)
  })

  it('reuses a file already in the project, which keeps its library and subject', async () => {
    const hero = put('hero.png', png(1))
    const first = dataOf(await importIt([hero], { library: 'reference', subjectId: 'bottle' }))
    put('pics/again.png', png(1))
    const data = dataOf(await importIt([path.join(dir, 'pics')]))
    expect(data).toEqual({
      assetIds: first.assetIds,
      reusedAssetIds: first.assetIds,
      skippedCount: 0,
    })
    expect(bus.db.prepare('SELECT library, subject_id FROM asset').all()).toEqual([
      { library: 'reference', subject_id: 'bottle' },
    ])
  })
})

// Where the platform cannot take the read permission away, there is nothing to test.
const canLockFiles = process.platform !== 'win32' && process.getuid?.() !== 0

describe('asset.import skips an unreadable file inside a folder [SPEC 14, Slice A rulings point 5]', () => {
  it.runIf(canLockFiles)('skips and counts it, and imports the rest', async () => {
    put('pics/good.png', png(1))
    const locked = put('pics/locked.png', png(2))
    fs.chmodSync(locked, 0o000)
    try {
      const data = dataOf(await importIt([path.join(dir, 'pics')]))
      expect(namesOf(data.assetIds)).toEqual(['good.png'])
      expect(data.skippedCount).toBe(1)
    } finally {
      fs.chmodSync(locked, 0o600)
    }
  })

  it.runIf(canLockFiles)('skips and counts a subfolder that cannot be listed', async () => {
    put('pics/good.png', png(1))
    put('pics/shut/inside.png', png(2))
    const shut = path.join(dir, 'pics', 'shut')
    fs.chmodSync(shut, 0o000)
    try {
      const data = dataOf(await importIt([path.join(dir, 'pics')]))
      expect(namesOf(data.assetIds)).toEqual(['good.png'])
      expect(data.skippedCount).toBe(1)
    } finally {
      fs.chmodSync(shut, 0o700)
    }
  })

  it.runIf(canLockFiles)('refuses a named folder that cannot be listed', async () => {
    put('shut/inside.png', png(1))
    const shut = path.join(dir, 'shut')
    fs.chmodSync(shut, 0o000)
    try {
      const error = await expectRefused(
        bus,
        () => importIt([shut]),
        'RULE_VIOLATION',
        'file_not_readable',
      )
      expect(error.message).toBe('shut could not be read.')
    } finally {
      fs.chmodSync(shut, 0o700)
    }
  })
})
