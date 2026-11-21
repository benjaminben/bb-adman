import { describe, it, expect } from 'vitest'
import { jpegOrientation } from '@/main/jpeg-orientation'

type Order = 'II' | 'MM'

// A TIFF block: the byte-order mark, 42, the IFD0 offset (8), then IFD0's entries.
// Each entry is [tag, type, count, value]; a SHORT value sits in the first two value bytes.
function tiff(order: Order, entries: Array<[number, number, number, number]>): number[] {
  const little = order === 'II'
  const bytes = new Uint8Array(8 + 2 + entries.length * 12 + 4)
  const view = new DataView(bytes.buffer)
  bytes.set([order.charCodeAt(0), order.charCodeAt(1)], 0)
  view.setUint16(2, 42, little)
  view.setUint32(4, 8, little)
  view.setUint16(8, entries.length, little)
  entries.forEach(([tag, type, count, value], i) => {
    const at = 10 + i * 12
    view.setUint16(at, tag, little)
    view.setUint16(at + 2, type, little)
    view.setUint32(at + 4, count, little)
    view.setUint16(at + 8, value, little)
  })
  return [...bytes]
}

// A JPEG start, an APP1 segment holding "Exif\0\0" and the TIFF block, then a frame header.
function jpegWith(app1Body: number[]): Uint8Array {
  const length = app1Body.length + 2
  return new Uint8Array([
    ...[0xff, 0xd8],
    ...[0xff, 0xe1, length >> 8, length & 0xff, ...app1Body],
    ...[0xff, 0xc0, 0x00, 0x0b, 0x08, 0, 1, 0, 1, 1, 1, 0x11, 0],
  ])
}

const EXIF = [0x45, 0x78, 0x69, 0x66, 0, 0]

function orientedJpeg(order: Order, value: number): Uint8Array {
  return jpegWith([...EXIF, ...tiff(order, [[0x0112, 3, 1, value]])])
}

describe('jpegOrientation reads the Exif orientation tag [EX-1, A-55]', () => {
  const values = [1, 2, 3, 4, 5, 6, 7, 8]
  for (const order of ['II', 'MM'] as const) {
    it(`reads every value 1 to 8 in ${order} byte order`, () => {
      expect(values.map((v) => jpegOrientation(orientedJpeg(order, v)))).toEqual(values)
    })
  }

  it('finds the tag after other entries', () => {
    const body = tiff('MM', [
      [0x010f, 2, 4, 0],
      [0x0112, 3, 1, 6],
    ])
    expect(jpegOrientation(jpegWith([...EXIF, ...body]))).toBe(6)
  })

  it('reads the tag after another APP segment', () => {
    const app0 = [0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46]
    const exif = orientedJpeg('II', 8)
    const bytes = new Uint8Array([0xff, 0xd8, ...app0, ...exif.slice(2)])
    expect(jpegOrientation(bytes)).toBe(8)
  })
})

describe('jpegOrientation reads anything missing or broken as upright [EX-1]', () => {
  const full = [...orientedJpeg('II', 6)]
  const hugeCount = [...EXIF, ...tiff('II', [[0x0112, 3, 1, 6]])]
  hugeCount[EXIF.length + 8] = 0xff
  hugeCount[EXIF.length + 9] = 0xff
  const farOffset = [...EXIF, ...tiff('MM', [[0x0112, 3, 1, 6]])]
  farOffset.splice(EXIF.length + 4, 4, 0x7f, 0xff, 0xff, 0xff)
  const lyingLength = [...full]
  lyingLength[4] = 0xff

  const cases: Array<[string, Uint8Array]> = [
    ['a JPEG with no Exif segment', new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0, 0x0b, 8, 0, 1])],
    ['a PNG', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    ['no bytes', new Uint8Array(0)],
    ['a segment cut off in the middle', new Uint8Array(full.slice(0, 20))],
    ['a segment length past the end of the file', new Uint8Array(lyingLength)],
    ['an IFD offset past the end of the segment', jpegWith(farOffset)],
    ['a huge entry count', jpegWith(hugeCount)],
    ['a tag value of 0', orientedJpeg('II', 0)],
    ['a tag value of 9', orientedJpeg('MM', 9)],
    ['a tag of the wrong type', jpegWith([...EXIF, ...tiff('II', [[0x0112, 4, 1, 6]])])],
    ['an unknown byte-order mark', jpegWith([...EXIF, 0x41, 0x41, ...tiff('II', []).slice(2)])],
    ['an APP1 segment that is not Exif', jpegWith([0x68, 0x74, 0x74, 0x70, 0, 0, 1, 2])],
    ['a segment too short for its header', jpegWith([0x45, 0x78])],
  ]
  for (const [what, bytes] of cases) {
    it(`reads ${what} as 1`, () => {
      expect(jpegOrientation(bytes)).toBe(1)
    })
  }

  it('reads only the first Exif segment', () => {
    const first = jpegWith([...EXIF, ...tiff('II', [[0x0112, 3, 1, 1]])])
    const second = orientedJpeg('II', 6)
    const bytes = new Uint8Array([...first.slice(0, -15), ...second.slice(2)])
    expect(jpegOrientation(bytes)).toBe(1)
  })
})
