// EX-1 (A-55): toPng and the picture fitter turn a decoded JPEG by its orientation tag before
// they encode or crop, since the PNG they make carries no tag. The decoded image is turned
// through its bitmap: `fromBitmap` is Electron's nativeImage.createFromBitmap, passed in so
// this file needs no Electron to be tested. PNG and WebP are never turned.
import { jpegOrientation, type Orientation } from './jpeg-orientation'
import { pictureType } from './providers/picture-type'
import { turnPixels } from './turn-pixels'

type Size = { width: number; height: number }
type Bitmapped = { getSize(): Size; toBitmap(): Buffer }

export type Turn<I> = (image: I, tag: Orientation) => I

// A turner over images that give their bitmap. A bitmap that is not four bytes for every
// pixel of the stated size is a broken decode: it throws, and the caller refuses.
export function bitmapTurner<I>(
  fromBitmap: (data: Buffer, size: Size) => I,
): (image: Bitmapped, tag: Orientation) => I {
  return (image, tag) => {
    const size = image.getSize()
    const data = image.toBitmap()
    if (size.width <= 0 || size.height <= 0 || data.length !== size.width * size.height * 4) {
      throw new Error('The decoded picture does not match its size')
    }
    const turned = turnPixels(data, size, tag)
    const bitmap = Buffer.from(turned.data.buffer, turned.data.byteOffset, turned.data.length)
    return fromBitmap(bitmap, { width: turned.width, height: turned.height })
  }
}

// The decoded image, turned the way its JPEG bytes say. Anything but a JPEG is left as it is.
export function upright<I>(bytes: Uint8Array, image: I, turn: Turn<I>): I {
  if (pictureType(bytes) !== 'image/jpeg') return image
  const tag = jpegOrientation(bytes)
  return tag === 1 ? image : turn(image, tag)
}
