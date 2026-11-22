import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { videoFileFacts, MAX_MOOV_BYTES } from '@/main/assets/video-file-facts'
import { box, ftyp, hdlr, mp4File, mvhd, trak } from '@/main/providers/fake/mp4'

let dir: string
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-facts-'))
})
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }))

const u32 = (n: number) => {
  const b = new Uint8Array(4)
  new DataView(b.buffer).setUint32(0, n)
  return b
}
const u64 = (n: bigint) => {
  const b = new Uint8Array(8)
  new DataView(b.buffer).setBigUint64(0, n)
  return b
}
const join = (...parts: Uint8Array[]) => new Uint8Array(Buffer.concat(parts))
const mdat = (n = 16) => box('mdat', new Uint8Array(n))
const moov = (ms = 4000, ...tracks: Uint8Array[]) =>
  box('moov', mvhd(1000, ms), ...(tracks.length ? tracks : [trak('vide', 640, 360)]))

let n = 0
async function factsOf(bytes: Uint8Array) {
  const file = path.join(dir, `f${n++}.mp4`)
  fs.writeFileSync(file, bytes)
  const handle = await fs.promises.open(file, 'r')
  try {
    return await videoFileFacts(handle)
  } finally {
    await handle.close()
  }
}

const FACTS = { width: 640, height: 360, durationMs: 4000, hasSound: false }

describe('videoFileFacts: the facts of an imported MP4 or MOV from its boxes [A-177, P7-5]', () => {
  it.each([
    ['moov first', join(ftyp(), moov(), mdat())],
    ['moov last, after a large mdat', join(ftyp(), mdat(200_000), moov())],
    ['a QuickTime file with no ftyp', join(box('wide'), mdat(), moov())],
    ['an mdat whose size 0 means "to the end"', join(ftyp(), moov(), u32(0), mdat().slice(4))],
    [
      'an mdat with a 64-bit size',
      join(ftyp(), u32(1), mdat().slice(4, 8), u64(24n), u64(0n), moov()),
    ],
  ])('reads width, height and duration: %s', async (_, bytes) => {
    expect(await factsOf(bytes)).toEqual(FACTS)
  })

  it('says whether the file has a sound track', async () => {
    const bytes = mp4File({ width: 1280, height: 720, durationMs: 8000, sound: true })
    expect(await factsOf(bytes)).toEqual({
      width: 1280,
      height: 720,
      durationMs: 8000,
      hasSound: true,
    })
  })

  const deep = (levels: number): Uint8Array =>
    levels === 0 ? box('free') : box('udta', deep(levels - 1))
  const manyBoxes = join(...Array.from({ length: 10_001 }, () => box('free')))
  const v1Mvhd = (timescale: number, duration: bigint) =>
    box('mvhd', u32(1 << 24), u64(0n), u64(0n), u32(timescale), u64(duration), new Uint8Array(80))

  it.each([
    ['a box past the end of the file', join(ftyp(), u32(9999), mdat().slice(4), moov())],
    ['a moov past the end of the file', join(ftyp(), moov().slice(0, 40))],
    ['no moov', join(ftyp(), mdat())],
    ['no video track', join(ftyp(), moov(4000, trak('soun')), mdat())],
    ['no tracks at all', join(ftyp(), box('moov', mvhd(1000, 4000)))],
    ['nesting too deep', join(ftyp(), moov(4000, trak('vide', 640, 360), deep(9)))],
    ['more than 10,000 boxes', join(ftyp(), manyBoxes, moov())],
    ['a side over the limit', join(ftyp(), moov(4000, trak('vide', 4097, 360)))],
    ['a timescale of 0', join(ftyp(), box('moov', mvhd(0, 4000), trak('vide', 640, 360)))],
    [
      'a duration too large to store',
      join(ftyp(), box('moov', v1Mvhd(1, 2n ** 62n), trak('vide', 640, 360))),
    ],
    [
      'a track header cut short',
      join(
        ftyp(),
        box('moov', mvhd(1000, 4000), box('trak', box('tkhd'), box('mdia', hdlr('vide')))),
      ),
    ],
    [
      'a 64-bit size shorter than its header',
      join(ftyp(), u32(1), mdat().slice(4, 8), u64(8n), moov()),
    ],
    ['a box header cut off before any moov', join(ftyp(), mdat(), u32(100))],
    ['an empty file', new Uint8Array()],
    ['text that is not a video', new TextEncoder().encode('just some words, not a clip')],
  ])('gives null for %s', async (_, bytes) => {
    expect(await factsOf(bytes)).toBeNull()
  })

  it('gives null for random bytes and never throws', async () => {
    let seed = 7
    const next = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) & 0xff
    for (let i = 0; i < 50; i++) {
      const bytes = Uint8Array.from({ length: 64 + i * 13 }, next)
      await expect(factsOf(join(ftyp(), bytes))).resolves.toBeNull()
    }
  })

  it('gives null when the file cannot be read', async () => {
    const failing = {
      stat: async () => ({ size: 100 }),
      read: async () => {
        throw new Error('EIO /secret/place/clip.mp4')
      },
    }
    expect(await videoFileFacts(failing as never)).toBeNull()
  })

  it('reads a moov over 32 MiB not at all, and gives null', async () => {
    const header = join(u32(MAX_MOOV_BYTES + 9), new TextEncoder().encode('moov'))
    const bytes = join(ftyp(), header)
    const file = path.join(dir, 'big.mp4')
    fs.writeFileSync(file, bytes)
    fs.truncateSync(file, ftyp().byteLength + MAX_MOOV_BYTES + 9)
    const handle = await fs.promises.open(file, 'r')
    let read = 0
    const counting = {
      stat: () => handle.stat(),
      read: async (buffer: Uint8Array, offset: number, length: number, at: number) => {
        read += length
        return handle.read(buffer, offset, length, at)
      },
    }
    try {
      expect(await videoFileFacts(counting as never)).toBeNull()
    } finally {
      await handle.close()
    }
    expect(read).toBeLessThan(1024)
  })

  it('reads a moov of exactly 32 MiB', async () => {
    const inner = [mvhd(1000, 4000), trak('vide', 640, 360)]
    const size = inner.reduce((s, b) => s + b.byteLength, 8)
    const pad = box('free', new Uint8Array(MAX_MOOV_BYTES - size - 8))
    const big = box('moov', ...inner, pad)
    expect(big.byteLength).toBe(MAX_MOOV_BYTES)
    expect(await factsOf(join(ftyp(), big))).toEqual(FACTS)
  })

  it('takes width and height from a version 1 track header', async () => {
    const v1 = box('tkhd', u32(1 << 24), new Uint8Array(84), u32(320 * 65536), u32(240 * 65536))
    const track = box('trak', v1, box('mdia', hdlr('vide')))
    expect(await factsOf(join(ftyp(), moov(4000, track)))).toMatchObject({
      width: 320,
      height: 240,
    })
  })
})
