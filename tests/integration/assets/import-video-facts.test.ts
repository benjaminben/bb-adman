import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { assetImport } from '@/main/commands/asset/import'
import { assetRelink } from '@/main/commands/asset/relink'
import { assetCheckChanged } from '@/main/commands/asset/check-changed'
import { box, ftyp, mp4File, mvhd, trak } from '@/main/providers/fake/mp4'
import { makeAssetBus, expectRefused } from './asset-bus'
import { insertTestAsset } from './asset-rows'
import { testLog, type TestLog } from './test-log'

let bus: ReturnType<typeof makeAssetBus>
let log: TestLog
let dir: string
const A = '01JD0000000000000000000001'
const mdat = () => box('mdat', new Uint8Array(16))

beforeEach(() => {
  log = testLog()
  const now = () => new Date('2026-11-20T10:00:00.000Z')
  bus = makeAssetBus([assetImport({ now, log }), assetRelink({ log }), assetCheckChanged({ log })])
  dir = path.dirname(bus.project.filePath)
})
afterEach(() => bus.cleanup())

const put = (rel: string, bytes: Uint8Array | string) => {
  const p = path.join(dir, rel)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, bytes)
  return p
}
const rows = () =>
  bus.db.prepare('SELECT * FROM asset ORDER BY rowid').all() as Array<Record<string, unknown>>
const facts = (r: Record<string, unknown> | undefined) => ({
  width: r?.width,
  height: r?.height,
  duration_ms: r?.duration_ms,
})
const importIt = (paths: string[]) =>
  bus.user('asset.import', { library: 'asset', copy: false, paths })

const CLIP = mp4File({ width: 640, height: 360, durationMs: 4000, sound: true })
const OTHER = mp4File({ width: 1080, height: 1920, durationMs: 9500, sound: false })
// A QuickTime file from before the ftyp box: moov first, no ftyp.
const OLD_MOV = new Uint8Array(
  Buffer.concat([box('moov', mvhd(600, 3000), trak('vide', 320, 240)), mdat()]),
)

describe('imported MP4 and MOV rows hold width, height and duration [A-177, P7-5]', () => {
  it.each([
    ['clip.mp4', CLIP, { width: 640, height: 360, duration_ms: 4000 }],
    ['clip.mov', CLIP, { width: 640, height: 360, duration_ms: 4000 }],
    ['old.mov', OLD_MOV, { width: 320, height: 240, duration_ms: 5000 }],
  ])('import fills the facts of %s', async (name, bytes, expected) => {
    const result = await importIt([put(path.join('in', name), bytes)])
    expect(result).toMatchObject({ ok: true })
    expect(facts(rows()[0])).toEqual(expected)
  })

  it.each([
    [
      'a sound-only file',
      Buffer.concat([ftyp(), box('moov', mvhd(1000, 4000), trak('soun')), mdat()]),
    ],
    [
      'box headers that run past the end',
      Buffer.concat([ftyp(), box('moov', mvhd(1000, 4000)).subarray(0, 20)]),
    ],
  ])('refuses a file named .mp4 holding %s, as any wrong bytes', async (_, bytes) => {
    const file = put(path.join('in', 'clip.mp4'), bytes)
    const error = await expectRefused(bus, () => importIt([file]), 'INVALID_INPUT')
    expect(error.message).toBe('clip.mp4 is not a file type the app accepts.')
  })

  it('skips a file with no video track inside a chosen folder', async () => {
    put(path.join('in', 'good.mp4'), CLIP)
    put(
      path.join('in', 'sound.mp4'),
      Buffer.concat([ftyp(), box('moov', mvhd(1000, 1), trak('soun'))]),
    )
    const result = await importIt([path.join(dir, 'in')])
    expect(result).toMatchObject({ ok: true, data: { skippedCount: 1 } })
    expect(rows().map((r) => r.display_name)).toEqual(['good.mp4'])
  })

  it('imports a WebM with no facts', async () => {
    const result = await importIt([
      put('in/clip.webm', Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f])),
    ])
    expect(result).toMatchObject({ ok: true })
    expect(facts(rows()[0])).toEqual({ width: null, height: null, duration_ms: null })
  })

  it('relink refills the facts from the new file', async () => {
    insertTestAsset(bus.db, {
      id: A,
      kind: 'video',
      mime: 'video/mp4',
      relPath: path.join('old', 'clip.mp4'),
      absPath: path.join(dir, 'old', 'clip.mp4'),
    })
    const result = await bus.user('asset.relink', {
      assetId: A,
      newPath: put(path.join('new', 'clip.mp4'), OTHER),
      relinkSiblings: false,
    })
    expect(result).toMatchObject({ ok: true })
    expect(facts(rows()[0])).toEqual({ width: 1080, height: 1920, duration_ms: 9500 })
  })

  it('the change check refills the facts when the file changed', async () => {
    const file = put('clip.mp4', CLIP)
    insertTestAsset(bus.db, {
      id: A,
      kind: 'video',
      mime: 'video/mp4',
      relPath: 'clip.mp4',
      absPath: file,
    })
    fs.writeFileSync(file, OTHER)
    await bus.user('asset.checkChanged', {})
    expect(facts(rows()[0])).toEqual({ width: 1080, height: 1920, duration_ms: 9500 })
  })

  it('the change check clears the facts when the file became another kind', async () => {
    const file = put('clip.mp4', CLIP)
    await importIt([file])
    fs.writeFileSync(file, 'now some words')
    await bus.user('asset.checkChanged', {})
    expect(facts(rows()[0])).toEqual({ width: null, height: null, duration_ms: null })
  })
})
