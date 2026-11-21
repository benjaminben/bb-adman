// SPEC 6.2 [1.18]: the one check every picture adapter uses. The type comes from the file
// signature, never from what the provider says it sent.
export type PictureType = 'image/png' | 'image/jpeg'

const SIGNATURES: Array<{ type: PictureType; bytes: number[] }> = [
  { type: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { type: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
]

// The type the bytes start with, or undefined when they are neither a PNG nor a JPEG.
export function pictureType(bytes: Uint8Array): PictureType | undefined {
  return SIGNATURES.find(
    (s) => bytes.length >= s.bytes.length && s.bytes.every((byte, i) => bytes[i] === byte),
  )?.type
}
