import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { assetImport } from '../../../src/main/commands/asset/import'
import { makeAssetBus, expectRefused } from './asset-bus'
import { testLog } from './test-log'

let bus: ReturnType<typeof makeAssetBus>
let dir: string
const NOW = new Date('2026-11-20T10:00:00.000Z')

// A PNG header for a 300 by 200 picture: signature, IHDR length, IHDR, width, height.
const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 1,
  0x2c, 0, 0, 0, 0xc8, 8, 6, 0, 0, 0,
])

beforeEach(() => {
  bus = makeAssetBus([assetImport({ now: () => NOW, log: testLog() })])
  dir = path.dirname(bus.project.filePath)
  bus.db
    .prepare("INSERT INTO subject (id, name, created_at) VALUES ('bottle', 'Bottle', 'x')")
    .run()
})
afterEach(() => bus.cleanup())

const put = (name: string, bytes: Buffer | string) => {
  const p = path.join(dir, 'in', name)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, bytes)
  return p
}
const rows = () =>
  bus.db.prepare('SELECT * FROM asset ORDER BY rowid').all() as Array<Record<string, unknown>>
const assetsDir = () => path.join(dir, 'P Assets')
const importIt = (input: Record<string, unknown>) =>
  bus.user('asset.import', { library: 'asset', copy: false, ...input })
const idsOf = (r: unknown) => (r as { data: { assetIds: string[] } }).data.assetIds

describe('asset.import, linking a file where it is [SPEC 4.2, 3.3, FR-050 to FR-054, R-08]', () => {
  it('adds a linked asset row read from the file and names it', async () => {
    const file = put('hero.png', PNG)
    const result = await bus.changed(() =>
      importIt({ paths: [file], library: 'reference', subjectId: 'bottle' }),
    )
    const [id] = idsOf(result)
    const stat = fs.statSync(file)
    expect(rows()).toEqual([
      expect.objectContaining({
        id,
        library: 'reference',
        kind: 'image',
        origin: 'imported',
        storage: 'linked',
        subject_id: 'bottle',
        display_name: 'hero.png',
        abs_path: file,
        rel_path: path.join('in', 'hero.png'),
        mime: 'image/png',
        byte_size: PNG.length,
        mtime_ms: Math.trunc(stat.mtimeMs),
        content_hash: crypto.createHash('sha256').update(PNG).digest('hex'),
        width: 300,
        height: 200,
        created_at: NOW.toISOString(),
      }),
    ])
    expect(fs.existsSync(assetsDir())).toBe(false)
  })

  it('reads the kind of each accepted type', async () => {
    const files = [put('copy.txt', 'Summer sale'), put('brand.otf', Buffer.from('OTTO\0\x0b'))]
    await importIt({ paths: files })
    expect(rows().map((r) => [r.kind, r.mime, r.width])).toEqual([
      ['text', 'text/plain', null],
      ['font', 'font/otf', null],
    ])
  })
})

describe('asset.import with copy [SPEC 3.1, 3.3, FR-007, FR-052]', () => {
  it('copies the file to {assetsDir}/{id}.{ext}, making the folder, and stores it as managed', async () => {
    const file = put('Hero.PNG', PNG)
    const [id] = idsOf(await bus.changed(() => importIt({ paths: [file], copy: true })))
    const copied = path.join(assetsDir(), `${id}.png`)
    expect(fs.readFileSync(copied)).toEqual(PNG)
    expect(rows()[0]).toMatchObject({
      storage: 'managed',
      abs_path: copied,
      rel_path: path.join('P Assets', `${id}.png`),
      display_name: 'Hero.PNG',
    })
  })

  it('removes the copies when run refuses', async () => {
    const file = put('hero.png', PNG)
    await expectRefused(
      bus,
      () => importIt({ paths: [file], copy: true, subjectId: 'cup' }),
      'NOT_FOUND',
    )
    expect(fs.readdirSync(assetsDir())).toEqual([])
  })
})

describe('asset.import reuses a file already in the project [SPEC 3.3 indexes, FR-053]', () => {
  it('gives the existing asset for the same content and adds no row', async () => {
    const [first] = idsOf(await importIt({ paths: [put('a.png', PNG)] }))
    const again = await bus.changed(() => importIt({ paths: [put('b.png', PNG)], copy: true }))
    expect(idsOf(again)).toEqual([first])
    expect(rows()).toHaveLength(1)
    expect(fs.existsSync(assetsDir())).toBe(false)
  })

  it('adds one row for two paths with the same content in one call', async () => {
    const ids = idsOf(await importIt({ paths: [put('a.png', PNG), put('b.png', PNG)] }))
    expect(ids[0]).toBe(ids[1])
    expect(rows()).toHaveLength(1)
  })
})

describe('asset.import refusals [SPEC 4.1, 8.3, 10.1]', () => {
  it('refuses a path that is not absolute with INVALID_INPUT', async () => {
    await expectRefused(bus, () => importIt({ paths: ['in/a.png'] }), 'INVALID_INPUT')
  })

  it('refuses a path that names nothing with NOT_FOUND', async () => {
    await expectRefused(bus, () => importIt({ paths: [path.join(dir, 'no.png')] }), 'NOT_FOUND')
  })

  it('refuses a folder with INVALID_INPUT', async () => {
    fs.mkdirSync(path.join(dir, 'pics.png'))
    await expectRefused(
      bus,
      () => importIt({ paths: [path.join(dir, 'pics.png')] }),
      'INVALID_INPUT',
    )
  })

  it('refuses a file whose bytes do not match its type, naming the file and not its path', async () => {
    const good = put('good.png', PNG)
    const bad = put('fake.png', 'not a picture')
    const error = await expectRefused(
      bus,
      () => importIt({ paths: [good, bad], copy: true }),
      'INVALID_INPUT',
    )
    expect(error.message).toBe('fake.png is not a file type the app accepts.')
    expect(JSON.stringify(error)).not.toContain(dir)
    expect(fs.existsSync(assetsDir())).toBe(false)
  })

  it('refuses an empty path list with INVALID_INPUT', async () => {
    await expectRefused(bus, () => importIt({ paths: [] }), 'INVALID_INPUT')
  })
})

describe('asset.import when the project changes between prepare and run [SPEC 3.6]', () => {
  it('refuses when an asset prepare reused was removed in between', async () => {
    const file = put('a.png', PNG)
    const [id] = idsOf(await importIt({ paths: [file] }))
    const handler = assetImport({ now: () => NOW, log: testLog() })
    const input = { projectId: bus.projectId, paths: [file], library: 'asset', copy: false }
    const base = { actor: 'user' as const, commandId: 'c1', project: bus.project }
    const prepared = await handler.prepare?.(base, input)
    bus.db.prepare('DELETE FROM asset WHERE id = ?').run(id)
    const run = () => handler.run({ ...base, changes: { touch: () => {} } }, input, prepared)
    expect(run).toThrow(expect.objectContaining({ code: 'RULE_VIOLATION' }))
  })
})

// A file with no read permission. Where the platform cannot take the permission away
// (Windows, or a test run as root), there is nothing to test.
const canLockFiles = process.platform !== 'win32' && process.getuid?.() !== 0

describe('asset.import, a file there but not readable [SPEC 14, Slice A rulings point 6, A2-4]', () => {
  it.runIf(canLockFiles)(
    'refuses with file_not_readable, naming the file and not its path',
    async () => {
      const good = put('good.png', PNG)
      const locked = put('locked.png', PNG.subarray(0, 20))
      fs.chmodSync(locked, 0o000)
      try {
        const error = await expectRefused(
          bus,
          () => importIt({ paths: [good, locked], copy: true }),
          'RULE_VIOLATION',
          'file_not_readable',
        )
        expect(error.message).toBe('locked.png could not be read.')
        expect(JSON.stringify(error)).not.toContain(dir)
        expect(fs.existsSync(assetsDir())).toBe(false)
      } finally {
        fs.chmodSync(locked, 0o600)
      }
    },
  )
})

describe('asset.import reply [SPEC 14, Slice A rulings point 5, A2-6]', () => {
  it('names the reused assets and counts no skipped entry', async () => {
    const [first] = idsOf(await importIt({ paths: [put('a.png', PNG)] }))
    const fresh = put('c.png', Buffer.concat([PNG, Buffer.from([1])]))
    const result = await importIt({ paths: [put('b.png', PNG), fresh, put('d.png', PNG)] })
    const [, freshId] = idsOf(result)
    expect(result).toEqual({
      ok: true,
      data: { assetIds: [first, freshId, first], reusedAssetIds: [first], skippedCount: 0 },
    })
  })

  it('gives empty reused list for files all new to the project', async () => {
    const result = await importIt({ paths: [put('a.png', PNG)] })
    expect(result).toEqual({
      ok: true,
      data: { assetIds: idsOf(result), reusedAssetIds: [], skippedCount: 0 },
    })
  })
})
