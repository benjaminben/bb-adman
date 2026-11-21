// Reads the chunks of a PNG file for tests, checking each chunk's CRC, and the text of an
// iTXt chunk (SPEC 6.6). Not a test file itself.
import zlib from 'node:zlib'

export type PngChunk = { type: string; data: Buffer; crcOk: boolean }

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

export function pngChunks(bytes: Uint8Array): PngChunk[] {
  const buf = Buffer.from(bytes)
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error('Not a PNG')
  const chunks: PngChunk[] = []
  let at = 8
  while (at < buf.length) {
    const length = buf.readUInt32BE(at)
    const type = buf.toString('latin1', at + 4, at + 8)
    const data = buf.subarray(at + 8, at + 8 + length)
    const crc = buf.readUInt32BE(at + 8 + length)
    chunks.push({ type, data, crcOk: zlib.crc32(buf.subarray(at + 4, at + 8 + length)) === crc })
    at += 12 + length
  }
  return chunks
}

// The keyword and text of an uncompressed iTXt chunk.
export function itxtOf(chunk: PngChunk): { keyword: string; text: string } {
  const d = chunk.data
  const end = d.indexOf(0)
  const keyword = d.toString('latin1', 0, end)
  const compressed = d[end + 1]
  if (compressed !== 0) throw new Error('Compressed iTXt')
  const langEnd = d.indexOf(0, end + 3)
  const transEnd = d.indexOf(0, langEnd + 1)
  return { keyword, text: d.toString('utf8', transEnd + 1) }
}

// The parsed JSON of the one `generation` iTXt chunk, or throws.
export function generationDetailsOf(bytes: Uint8Array): Record<string, unknown> {
  const found = pngChunks(bytes)
    .filter((c) => c.type === 'iTXt')
    .map(itxtOf)
    .filter((t) => t.keyword === 'generation')
  if (found.length !== 1) throw new Error(`Expected one generation chunk, got ${found.length}`)
  return JSON.parse(found[0]?.text ?? '') as Record<string, unknown>
}
