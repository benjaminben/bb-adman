// P8-4: CoreDeps.exportPictures over fake decode and fromBitmap (spec/phases/phase-08.md
// "Drawing at full size"). Electron's nativeImage is never loaded here.
import { describe, it, expect, vi } from 'vitest'
import { createExportPictures, type EncoderImage } from '@/main/export/picture-encoder'

type Size = { width: number; height: number }

// A fake decoded image: its bitmap is `data`, its encodings are fixed marker bytes.
function image(size: Size, data: Buffer = Buffer.alloc(size.width * size.height * 4)) {
  const img = {
    isEmpty: () => size.width === 0 || size.height === 0,
    getSize: () => size,
    toBitmap: () => data,
    toPNG: vi.fn(() => Buffer.from([0x89, 1])),
    toJPEG: vi.fn((_q: number) => Buffer.from([0xff, 0xd8, 2])),
    resize: vi.fn((_s: Size): EncoderImage => resized),
  }
  const resized = {
    ...img,
    getSize: () => size,
    toJPEG: vi.fn((_q: number) => Buffer.from([0xff, 0xd8, 3])),
  }
  return { img, resized }
}

function encoder(byTag: Record<number, EncoderImage>) {
  const made: Array<{ data: Buffer; size: Size; png: Buffer }> = []
  const decode = vi.fn((bytes: Buffer) => {
    const found = byTag[bytes[0] ?? -1]
    if (!found) throw new Error('unknown picture')
    return found
  })
  const fromBitmap = vi.fn((data: Buffer, size: Size) => {
    const png = Buffer.from([0x89, 9, size.width, size.height])
    made.push({ data, size, png })
    return { ...image(size, data).img, toPNG: () => png }
  })
  return { pictures: createExportPictures(decode, fromBitmap), decode, fromBitmap, made }
}

describe('createExportPictures [P8-4]', () => {
  it('toJpeg passes the quality to the encoder and gives its bytes', () => {
    const { img } = image({ width: 4, height: 2 })
    const { pictures } = encoder({ 1: img })
    expect([...pictures.toJpeg(new Uint8Array([1]), 73)]).toEqual([0xff, 0xd8, 2])
    expect(img.toJPEG).toHaveBeenCalledWith(73)
  })

  it('refuses a picture that does not decode', () => {
    const { img } = image({ width: 0, height: 0 })
    const { pictures } = encoder({ 1: img })
    expect(() => pictures.toJpeg(new Uint8Array([1]), 80)).toThrow()
    expect(() => pictures.shrink(new Uint8Array([1]), 240)).toThrow()
    expect(() =>
      pictures.stitch([{ x: 0, y: 0, png: new Uint8Array([1]) }], { width: 1, height: 1 }),
    ).toThrow()
  })

  it.each([
    [
      { width: 1080, height: 1350 },
      { width: 192, height: 240 },
    ],
    [
      { width: 4000, height: 1000 },
      { width: 240, height: 60 },
    ],
    [
      { width: 1080, height: 1080 },
      { width: 240, height: 240 },
    ],
    [
      { width: 8192, height: 50 },
      { width: 240, height: 1 },
    ],
    [
      { width: 50, height: 100 },
      { width: 120, height: 240 },
    ],
  ])('shrink keeps the ratio of %o with the longest side 240 and gives JPEG 80', (from, to) => {
    const { img, resized } = image(from)
    const { pictures } = encoder({ 1: img })
    expect([...pictures.shrink(new Uint8Array([1]), 240)]).toEqual([0xff, 0xd8, 3])
    expect(img.resize).toHaveBeenCalledWith(expect.objectContaining(to))
    expect(resized.toJPEG).toHaveBeenCalledWith(80)
  })

  it('stitch decodes each tile, joins the bitmaps and encodes one new PNG of the full size', () => {
    const left = image({ width: 2, height: 1 }, Buffer.from([1, 1, 1, 1, 2, 2, 2, 2])).img
    const right = image({ width: 1, height: 1 }, Buffer.from([3, 3, 3, 3])).img
    const { pictures, made } = encoder({ 1: left, 2: right })
    const parts = [
      { x: 0, y: 0, png: new Uint8Array([1]) },
      { x: 2, y: 0, png: new Uint8Array([2]) },
    ]
    const out = pictures.stitch(parts, { width: 3, height: 1 })
    expect(made).toHaveLength(1)
    expect(made[0]?.size).toEqual({ width: 3, height: 1 })
    expect([...(made[0]?.data ?? [])]).toEqual([1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3])
    expect([...out]).toEqual([...(made[0]?.png ?? [])])
    // FR-068: the output is a fresh encode of pixels, never a tile's own bytes or chunks.
    expect(left.toPNG).not.toHaveBeenCalled()
    expect(right.toPNG).not.toHaveBeenCalled()
  })

  it('stitch refuses a tile whose bitmap does not match its stated size', () => {
    const broken = image({ width: 2, height: 2 }, Buffer.alloc(3)).img
    const { pictures } = encoder({ 1: broken })
    const parts = [{ x: 0, y: 0, png: new Uint8Array([1]) }]
    expect(() => pictures.stitch(parts, { width: 2, height: 2 })).toThrow()
  })
})
