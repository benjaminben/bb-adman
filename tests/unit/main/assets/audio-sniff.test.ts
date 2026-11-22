import { describe, it, expect } from 'vitest'
import { AUDIO_MATCHES } from '@/main/assets/audio-sniff'

const utf8 = (s: string) => [...new TextEncoder().encode(s)]
const bytes = (...parts: Array<number[] | string>) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === 'string' ? utf8(p) : p)))
const ftyp = (major: string) => bytes([0, 0, 0, 0x18], 'ftyp', major, [0, 0, 0, 0], 'isom')

describe('the first bytes of a sound file [A-185, P7-5]', () => {
  it.each([
    ['mp3', bytes('ID3', [4, 0, 0])],
    ['mp3', bytes([0xff, 0xfb, 0x90, 0x64])],
    ['mp3', bytes([0xff, 0xf3, 0x90, 0x64])],
    ['mp3', bytes([0xff, 0xe3, 0x90, 0x64])],
    ['wav', bytes('RIFF', [1, 2, 3, 4], 'WAVEfmt ')],
    ['m4a', ftyp('M4A ')],
    ['m4a', ftyp('mp42')],
    ['m4a', ftyp('isom')],
    ['aac', bytes([0xff, 0xf1, 0x50, 0x80])],
    ['aac', bytes([0xff, 0xf9, 0x50, 0x80])],
  ] as const)('accepts %s bytes that match', (id, head) => {
    expect(AUDIO_MATCHES[id](head)).toBe(true)
  })

  it.each([
    ['mp3', bytes('ID')],
    ['mp3', bytes([0xff, 0xf1, 0x50, 0x80])],
    ['mp3', bytes([0xff, 0xf9, 0x50, 0x80])],
    ['mp3', bytes([0xff, 0xd8, 0xff, 0xe0])],
    ['mp3', bytes([0xfe, 0xfb, 0x90, 0x64])],
    ['wav', bytes('RIFF', [1, 2, 3, 4], 'WEBPVP8 ')],
    ['wav', bytes('RIFX', [1, 2, 3, 4], 'WAVEfmt ')],
    ['m4a', ftyp('M4B ')],
    ['m4a', ftyp('qt  ')],
    ['m4a', bytes([0, 0, 0, 0x18], 'moov')],
    ['aac', bytes([0xff, 0xfb, 0x90, 0x64])],
    ['aac', bytes([0xff, 0xf0, 0x50, 0x80])],
    ['aac', bytes('ID3', [4, 0, 0])],
  ] as const)('refuses %s bytes that do not match', (id, head) => {
    expect(AUDIO_MATCHES[id](head)).toBe(false)
  })

  it.each(['mp3', 'wav', 'm4a', 'aac'] as const)('refuses %s with no bytes', (id) => {
    expect(AUDIO_MATCHES[id](new Uint8Array())).toBe(false)
  })
})
