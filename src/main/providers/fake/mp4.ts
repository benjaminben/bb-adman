// A small MP4 maker for the fake provider and the tests (SPEC 6.10.7): box headers only, the
// fields checkMp4 reads, and no picture data. Never used on a file from outside the app.
const ascii = (text: string) => new TextEncoder().encode(text)

function u32(n: number): Uint8Array {
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setUint32(0, n)
  return bytes
}

function joined(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.byteLength, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.byteLength
  }
  return out
}

// One box: a 32-bit size, the four-letter type, then the parts.
export function box(type: string, ...parts: Uint8Array[]): Uint8Array {
  const body = joined(parts)
  return joined([u32(8 + body.byteLength), ascii(type), body])
}

export const ftyp = () => box('ftyp', ascii('isom'), u32(0), ascii('isom'))

// Version 0 movie header: timescale at 12, duration at 16 (from the start of the payload).
export function mvhd(timescale: number, duration: number): Uint8Array {
  return box('mvhd', u32(0), u32(0), u32(0), u32(timescale), u32(duration), new Uint8Array(80))
}

// Version 0 track header: width and height as 16.16 numbers at 76 and 80.
export function tkhd(width: number, height: number): Uint8Array {
  return box('tkhd', new Uint8Array(76), u32(width * 65536), u32(height * 65536))
}

export function hdlr(handler: string): Uint8Array {
  return box('hdlr', u32(0), u32(0), ascii(handler), new Uint8Array(12))
}

export function trak(handler: string, width = 0, height = 0): Uint8Array {
  return box('trak', tkhd(width, height), box('mdia', hdlr(handler)))
}

export type Mp4Facts = { width: number; height: number; durationMs: number; sound: boolean }

// A file checkMp4 accepts, with these facts.
export function mp4File(facts: Mp4Facts): Uint8Array {
  const tracks = [trak('vide', facts.width, facts.height)]
  if (facts.sound) tracks.push(trak('soun'))
  const moov = box('moov', mvhd(1000, facts.durationMs), ...tracks)
  return joined([ftyp(), moov, box('mdat', new Uint8Array(16))])
}
