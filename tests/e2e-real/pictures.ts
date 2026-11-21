// SPEC 14 1.56 E2E-R, "Product photos", with the P-1 rules of 1.54: each given file is read
// once into memory and refused, with one fixed line naming only its place in the list, when
// it is over MAX_PICTURE_BYTES, not a PNG or a JPEG by its bytes, or over 1,600 px on its
// long side. The path itself goes only to the file-dialog stub; it is never printed.
import fs from 'node:fs'
import { pictureType } from '@/main/providers/picture-type'
import { pictureSize } from '@/main/providers/picture-size'
import { MAX_PICTURE_BYTES } from '@/main/providers/picture-limits'

export const MAX_PICTURE_SIDE = 1_600

export function pictureRefusal(place: number): string {
  return (
    `The given picture ${place} cannot be used: it must be a PNG or JPEG of at most ` +
    `${MAX_PICTURE_SIDE} px on its long side. Make a smaller copy outside the repo.`
  )
}

function fits(bytes: Uint8Array): boolean {
  if (bytes.byteLength > MAX_PICTURE_BYTES) return false
  const mime = pictureType(bytes)
  if (!mime) return false
  const { width, height } = pictureSize(bytes, mime)
  return Math.max(width, height) <= MAX_PICTURE_SIDE
}

function readFits(file: string): boolean {
  try {
    return fits(new Uint8Array(fs.readFileSync(file)))
  } catch {
    return false
  }
}

export function checkPicture(file: string, place: number): void {
  if (!readFits(file)) throw new Error(pictureRefusal(place))
}
