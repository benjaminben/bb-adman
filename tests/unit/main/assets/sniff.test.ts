import { describe, it, expect } from 'vitest'
import { sniffType, SNIFF_BYTES } from '@/main/assets/sniff'

const utf8 = (s: string) => [...new TextEncoder().encode(s)]
const bytes = (...parts: Array<number[] | string>) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === 'string' ? utf8(p) : p)))

const PNG = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], [0, 0, 0, 13])
const JPEG = bytes([0xff, 0xd8, 0xff, 0xe0, 0, 16])
const WEBP = bytes('RIFF', [1, 2, 3, 4], 'WEBPVP8 ')
const MP4 = bytes([0, 0, 0, 0x18], 'ftypisom', [0, 0, 2, 0])
const MOV_OLD = bytes([0, 0, 0, 8], 'wide', [0, 0, 0, 8], 'mdat')
const WEBM = bytes([0x1a, 0x45, 0xdf, 0xa3, 0x9f])
const TTF = bytes([0, 1, 0, 0, 0, 0x10])
const OTF = bytes('OTTO', [0, 0x0b])
const WOFF2 = bytes('wOF2', [0, 1, 0, 0])

describe('type sniffing: the extension and the first bytes must agree [SPEC 8.3, FR-051]', () => {
  it.each([
    ['photo.png', PNG, 'image/png'],
    ['photo.JPG', JPEG, 'image/jpeg'],
    ['photo.webp', WEBP, 'image/webp'],
    ['clip.mp4', MP4, 'video/mp4'],
    ['clip.mov', MP4, 'video/quicktime'],
    ['clip.mov', MOV_OLD, 'video/quicktime'],
    ['clip.webm', WEBM, 'video/webm'],
    ['font.ttf', TTF, 'font/ttf'],
    ['font.ttf', bytes('true', [0, 1]), 'font/ttf'],
    ['font.otf', OTF, 'font/otf'],
    ['font.woff2', WOFF2, 'font/woff2'],
    ['copy.txt', bytes('Summer sale'), 'text/plain'],
    ['brief.yaml', bytes('campaignName: Été'), 'application/yaml'],
    ['brief.json', bytes('{"a":1}'), 'application/json'],
    ['notes.md', bytes('# Title'), 'text/markdown'],
  ])('accepts %s whose bytes match', (name, head, mime) => {
    expect(sniffType(name, head)).toMatchObject({ mime })
  })

  it.each([
    ['photo.png', JPEG],
    ['photo.jpg', PNG],
    ['photo.webp', bytes('RIFF', [1, 2, 3, 4], 'WAVEfmt ')],
    ['clip.mp4', MOV_OLD],
    ['clip.webm', MP4],
    ['font.ttf', OTF],
    ['font.woff2', bytes('wOFF', [0, 1])],
    ['copy.txt', bytes('a', [0], 'b')],
    ['copy.txt', bytes([0xff, 0xfe, 0x41])],
    ['photo.png', new Uint8Array()],
    ['copy.txt', new Uint8Array()],
  ])('refuses %s whose bytes do not match', (name, head) => {
    expect(sniffType(name, head)).toBeUndefined()
  })

  it('refuses an extension that is not in the list, whatever the bytes', () => {
    expect(sniffType('photo.gif', PNG)).toBeUndefined()
    expect(sniffType('photo', PNG)).toBeUndefined()
  })

  it('accepts text whose first bytes end part way through a character', () => {
    const cut = bytes('Caf', [0xc3])
    expect(sniffType('copy.txt', cut)).toMatchObject({ mime: 'text/plain' })
  })

  it('reads a fixed number of first bytes', () => {
    expect(SNIFF_BYTES).toBe(4096)
  })
})
