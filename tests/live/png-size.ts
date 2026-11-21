// SPEC 6.2 O-8: the live test prints the picture's pixel size, read from the PNG itself.
// A PNG starts with an 8-byte signature, then the IHDR chunk, whose width and height are
// 4-byte big-endian numbers at bytes 16 and 20.
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const IHDR = [0x49, 0x48, 0x44, 0x52]

export function pngPixelSize(bytes: Uint8Array): { width: number; height: number } {
  const signed = PNG_SIGNATURE.every((byte, i) => bytes[i] === byte)
  const header = IHDR.every((byte, i) => bytes[12 + i] === byte)
  if (!signed || !header || bytes.length < 24) throw new Error('The picture is not a PNG')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}
