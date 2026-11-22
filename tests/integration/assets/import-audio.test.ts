import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { assetImport } from '@/main/commands/asset/import'
import { makeAssetBus, expectRefused } from './asset-bus'
import { testLog } from './test-log'

let bus: ReturnType<typeof makeAssetBus>
let dir: string

beforeEach(() => {
  bus = makeAssetBus([
    assetImport({ now: () => new Date('2026-11-20T10:00:00.000Z'), log: testLog() }),
  ])
  dir = path.dirname(bus.project.filePath)
})
afterEach(() => bus.cleanup())

const put = (name: string, bytes: Buffer) => {
  const p = path.join(dir, 'in', name)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, bytes)
  return p
}
const rows = () =>
  bus.db.prepare('SELECT * FROM asset ORDER BY rowid').all() as Array<Record<string, unknown>>
const importIt = (paths: string[]) =>
  bus.user('asset.import', { library: 'asset', copy: false, paths })

const ftyp = (major: string) =>
  Buffer.concat([
    Buffer.from([0, 0, 0, 0x18]),
    Buffer.from(`ftyp${major}`),
    Buffer.alloc(4),
    Buffer.from('isom'),
  ])

describe('MP3, WAV, M4A and AAC import as kind audio [A-185, P7-5]', () => {
  it.each([
    [
      'tune.mp3',
      Buffer.concat([Buffer.from('ID3'), Buffer.from([4, 0, 0, 0, 0, 0, 0])]),
      'audio/mpeg',
    ],
    ['tune-frame.mp3', Buffer.from([0xff, 0xfb, 0x90, 0x64, 0, 0, 0, 0]), 'audio/mpeg'],
    [
      'tune.wav',
      Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVEfmt ')]),
      'audio/wav',
    ],
    ['tune.m4a', ftyp('M4A '), 'audio/mp4'],
    ['tune.aac', Buffer.from([0xff, 0xf1, 0x50, 0x80, 0, 0, 0]), 'audio/aac'],
  ])('imports %s as a sound file with no picture size or duration', async (name, bytes, mime) => {
    const result = await importIt([put(name, bytes)])
    expect(result).toMatchObject({ ok: true })
    expect(rows()).toEqual([
      expect.objectContaining({
        kind: 'audio',
        mime,
        display_name: name,
        width: null,
        height: null,
        duration_ms: null,
      }),
    ])
  })

  it.each([
    ['tune.mp3', Buffer.from('words, not sound')],
    ['tune.wav', Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')])],
    ['tune.m4a', ftyp('heic')],
    ['tune.aac', Buffer.from([0xff, 0xfb, 0x90, 0x64])],
  ])('refuses %s whose bytes are not that sound type', async (name, bytes) => {
    const error = await expectRefused(bus, () => importIt([put(name, bytes)]), 'INVALID_INPUT')
    expect(error.message).toBe(`${name} is not a file type the app accepts.`)
  })
})
