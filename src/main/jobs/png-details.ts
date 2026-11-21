// SPEC 6.6 [FR-068]: the generation details, as one uncompressed iTXt chunk with keyword
// `generation`, put just before IEND. The PNG comes from the app's own encoder (toPng), so
// IEND is its last chunk. Returns new bytes; the input is not changed.
import zlib from 'node:zlib'

export type GenerationDetails = {
  app: 'Adman'
  appVersion: string
  provider: string
  model: string
  prompt: string
  kind: 'image_generation'
  createdAt: string
}

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const IEND_LENGTH = 12

function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(data.length, 0)
  head.write(type, 4, 'latin1')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([head.subarray(4), data])), 0)
  return Buffer.concat([head, data, crc])
}

// keyword, NUL, compression flag 0, method 0, empty language tag, NUL, empty translated
// keyword, NUL, then the UTF-8 text.
function itxt(keyword: string, text: string): Buffer {
  const data = Buffer.concat([
    Buffer.from(keyword, 'latin1'),
    Buffer.from([0, 0, 0, 0, 0]),
    Buffer.from(text, 'utf8'),
  ])
  return chunk('iTXt', data)
}

export function embedGenerationDetails(png: Uint8Array, details: GenerationDetails): Uint8Array {
  const buf = Buffer.from(png)
  if (buf.length < SIGNATURE.length + IEND_LENGTH || !buf.subarray(0, 8).equals(SIGNATURE)) {
    throw new Error('The picture is not a PNG')
  }
  const iendAt = buf.length - IEND_LENGTH
  const iend = buf.subarray(iendAt)
  if (iend.readUInt32BE(0) !== 0 || iend.toString('latin1', 4, 8) !== 'IEND') {
    throw new Error('The PNG does not end with IEND')
  }
  const text = itxt('generation', JSON.stringify(details))
  return new Uint8Array(Buffer.concat([buf.subarray(0, iendAt), text, iend]))
}
