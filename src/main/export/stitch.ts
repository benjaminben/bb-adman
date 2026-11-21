// spec/phases/phase-08.md, "Drawing at full size": the tiles of a big draw, joined into one
// bitmap in the main process. Four bytes a pixel in the order the decoder gives them (BGRA from
// nativeImage); the copy never looks at the channels. Pure.
type Size = { width: number; height: number }

export type BitmapPart = { x: number; y: number; width: number; height: number; data: Uint8Array }

const BYTES = 4

function fits(part: BitmapPart, size: Size): boolean {
  const whole = [part.x, part.y, part.width, part.height].every(Number.isInteger)
  return (
    whole &&
    part.x >= 0 &&
    part.y >= 0 &&
    part.width > 0 &&
    part.height > 0 &&
    part.x + part.width <= size.width &&
    part.y + part.height <= size.height
  )
}

export function stitchBitmaps(parts: BitmapPart[], size: Size): Uint8Array {
  const out = new Uint8Array(size.width * size.height * BYTES)
  for (const part of parts) {
    if (!fits(part, size)) throw new Error('A tile reaches outside the picture.')
    if (part.data.length !== part.width * part.height * BYTES) {
      throw new Error('A tile does not match its size.')
    }
    const rowBytes = part.width * BYTES
    for (let row = 0; row < part.height; row++) {
      const from = row * rowBytes
      const to = ((part.y + row) * size.width + part.x) * BYTES
      out.set(part.data.subarray(from, from + rowBytes), to)
    }
  }
  return out
}
