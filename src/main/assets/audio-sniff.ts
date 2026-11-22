// A-185 (P7-5): the first-byte signatures of the sound types, for sniff.ts. Imported files
// are untrusted, so the bytes decide, not the name.
const asciiAt = (head: Uint8Array, at: number, text: string) =>
  [...text].every((c, i) => head[at + i] === c.charCodeAt(0))

// An MPEG audio frame: 11 sync bits, then a layer that is not the reserved 00.
const isMpegFrame = (h: Uint8Array) =>
  h[0] === 0xff && h[1] !== undefined && (h[1] & 0xe0) === 0xe0 && ((h[1] >> 1) & 3) !== 0

// The brands an M4A file is written with; the .m4a name says it holds sound only.
const M4A_BRANDS = ['M4A ', 'mp42', 'isom']

export const AUDIO_MATCHES = {
  mp3: (h: Uint8Array) => asciiAt(h, 0, 'ID3') || isMpegFrame(h),
  wav: (h: Uint8Array) => asciiAt(h, 0, 'RIFF') && asciiAt(h, 8, 'WAVE'),
  m4a: (h: Uint8Array) => asciiAt(h, 4, 'ftyp') && M4A_BRANDS.some((b) => asciiAt(h, 8, b)),
  // An ADTS header: sync, MPEG-4 or MPEG-2, layer 00, no checksum.
  aac: (h: Uint8Array) => h[0] === 0xff && (h[1] === 0xf1 || h[1] === 0xf9),
}
