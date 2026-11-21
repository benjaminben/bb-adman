import { describe, it, expect } from 'vitest'
import { checkMp4, MP4_REFUSED } from '../../../../src/main/providers/video-check'
import { MAX_VIDEO_BYTES, MAX_VIDEO_MS } from '../../../../src/main/providers/picture-limits'
import {
  box,
  ftyp,
  hdlr,
  mp4File,
  mvhd,
  trak,
} from '../../../../src/main/providers/fake/mp4'

const join = (...parts: Uint8Array[]) => Buffer.concat(parts)
const head = (size: number, type: string) => {
  const bytes = Buffer.alloc(8)
  bytes.writeUInt32BE(size, 0)
  bytes.write(type, 4, 'latin1')
  return bytes
}
const facts = { width: 384, height: 672, durationMs: 2_333, sound: false }
const moovWith = (...parts: Uint8Array[]) => box('moov', mvhd(1000, 2000), ...parts)

describe('checkMp4 [SPEC 6.10.7] (security class)', () => {
  it('reports the size, length and no sound of a clip without a sound track', () => {
    expect(checkMp4(mp4File(facts))).toEqual({
      width: 384,
      height: 672,
      durationMs: 2_333,
      hasSound: false,
    })
  })

  it('accepts a clip with a sound track and reports hasSound true [1.39]', () => {
    expect(checkMp4(mp4File({ ...facts, sound: true })).hasSound).toBe(true)
  })

  it('reads the length from the movie timescale', () => {
    const file = join(ftyp(), box('moov', mvhd(24, 48), trak('vide', 8, 8)))
    expect(checkMp4(file).durationMs).toBe(2_000)
  })

  it('refuses a file over MAX_VIDEO_BYTES before reading it', () => {
    const big = new Uint8Array(MAX_VIDEO_BYTES + 1)
    expect(() => checkMp4(big)).toThrow(MP4_REFUSED.tooLarge)
  })

  it('refuses a file whose first box is not ftyp', () => {
    expect(() => checkMp4(join(box('moov', mvhd(1000, 1)), ftyp()))).toThrow(MP4_REFUSED.notMp4)
    expect(() => checkMp4(new Uint8Array(0))).toThrow(MP4_REFUSED.notMp4)
    expect(() => checkMp4(Buffer.from('\x89PNG\r\n\x1a\n0000', 'latin1'))).toThrow(
      MP4_REFUSED.notMp4,
    )
  })

  it.each([
    ['0', join(ftyp(), head(0, 'free'))],
    ['below 8', join(ftyp(), head(7, 'free'))],
    ['past the end of the file', join(ftyp(), head(64, 'free'))],
    ['past the end of its parent', join(ftyp(), box('moov', head(64, 'trak')))],
    ['a header cut short', join(ftyp(), Buffer.from([0, 0]))],
  ])('refuses a box size of %s', (_, file) => {
    expect(() => checkMp4(file)).toThrow(MP4_REFUSED.badBox)
  })

  it('refuses a 64-bit box size past the end of the file', () => {
    const large = Buffer.alloc(16)
    large.writeUInt32BE(1, 0)
    large.write('free', 4, 'latin1')
    large.writeBigUInt64BE(1n << 40n, 8)
    expect(() => checkMp4(join(ftyp(), large))).toThrow(MP4_REFUSED.badBox)
  })

  it('refuses more than 10,000 boxes', () => {
    const many = Array.from({ length: 10_000 }, () => box('free'))
    expect(() => checkMp4(join(mp4File(facts), ...many))).toThrow(MP4_REFUSED.tooManyBoxes)
    const fits = Array.from({ length: 9_000 }, () => box('free'))
    expect(() => checkMp4(join(mp4File(facts), ...fits))).not.toThrow()
  })

  it('refuses boxes more than 8 levels deep', () => {
    let deep = trak('vide', 8, 8)
    for (let i = 0; i < 8; i++) deep = box('moov', deep)
    expect(() => checkMp4(join(ftyp(), deep))).toThrow(MP4_REFUSED.tooDeep)
  })

  it('refuses a file with no moov box', () => {
    expect(() => checkMp4(join(ftyp(), box('mdat', new Uint8Array(8))))).toThrow(
      MP4_REFUSED.noVideo,
    )
  })

  it('refuses a moov with no video track', () => {
    expect(() => checkMp4(join(ftyp(), moovWith(trak('soun'))))).toThrow(MP4_REFUSED.noVideo)
  })

  it('refuses a width or height over MAX_VIDEO_SIDE', () => {
    expect(() => checkMp4(mp4File({ ...facts, width: 4_097 }))).toThrow(MP4_REFUSED.tooBig)
    expect(() => checkMp4(mp4File({ ...facts, height: 4_097 }))).toThrow(MP4_REFUSED.tooBig)
    expect(() => checkMp4(mp4File({ ...facts, width: 4_096, height: 4_096 }))).not.toThrow()
  })

  it('refuses a length over MAX_VIDEO_MS, and a movie with no timescale', () => {
    const long = mp4File({ ...facts, durationMs: MAX_VIDEO_MS + 1 })
    expect(() => checkMp4(long)).toThrow(MP4_REFUSED.tooLong)
    const noScale = join(ftyp(), box('moov', mvhd(0, 10), trak('vide', 8, 8)))
    expect(() => checkMp4(noScale)).toThrow(MP4_REFUSED.tooLong)
  })

  it('refuses a movie with no header, or a header too short for its fields', () => {
    expect(() => checkMp4(join(ftyp(), box('moov', trak('vide', 8, 8))))).toThrow(
      MP4_REFUSED.noVideo,
    )
    const short = join(ftyp(), box('moov', box('mvhd', new Uint8Array(8)), trak('vide', 8, 8)))
    expect(() => checkMp4(short)).toThrow(MP4_REFUSED.badBox)
    const shortTrack = box('trak', box('tkhd', new Uint8Array(20)), box('mdia', hdlr('vide')))
    expect(() => checkMp4(join(ftyp(), moovWith(shortTrack)))).toThrow(MP4_REFUSED.badBox)
  })

  it('throws plain Errors with fixed messages that hold nothing from the file', () => {
    const marked = join(ftyp(), box('moov', mvhd(1000, 1), trak('MARK')))
    try {
      checkMp4(marked)
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(Error)
      expect((e as Error).message).not.toContain('MARK')
    }
  })
})
