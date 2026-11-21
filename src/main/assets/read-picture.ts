// SPEC 14 [1.25] point 7, [1.27] R2 (security class): AssetService.read loads a file into
// memory and its result is sent to a provider. The size is checked before any byte is read
// and again on the bytes read; the type comes from the bytes, never from the row.
// Slice WP and ruling F-9: with converters handed in, what it gives is always a clean PNG.
import fs from 'node:fs'
import {
  MAX_PICTURE_BYTES,
  MAX_PICTURE_PIXELS,
  MAX_PICTURE_SIDE,
} from '@/main/providers/picture-limits'
import { pictureType } from '@/main/providers/picture-type'
import { pngPixelSize } from '@/main/providers/png-size'
import { webpInfo } from '@/main/providers/webp-size'
import { hasWebpSignature } from './sniff'
import { AppError } from '@/shared/schemas/result'
import type { ImageFile } from '@/main/providers/types'

const MB = 1024 * 1024

function tooLarge(displayName: string): AppError {
  return new AppError(
    'RULE_VIOLATION',
    `${displayName} is too large to send. The limit is ${MAX_PICTURE_BYTES / MB} MB.`,
    { reason: 'asset_too_large' },
  )
}

export function notAPicture(displayName: string): AppError {
  return new AppError('RULE_VIOLATION', `${displayName} is not a picture the app can send.`, {
    reason: 'asset_not_a_picture',
  })
}

const CHUNK = 64 * 1024

// Reads to the end of the file or to max + 1 bytes, whichever comes first, so a file that
// grew after stat is never read whole.
async function readAtMost(file: string, max: number): Promise<Uint8Array> {
  const handle = await fs.promises.open(file, 'r')
  try {
    const chunks: Buffer[] = []
    let length = 0
    while (length <= max) {
      const chunk = Buffer.alloc(Math.min(CHUNK, max + 1 - length))
      const { bytesRead } = await handle.read(chunk, 0, chunk.length, null)
      if (bytesRead === 0) break
      chunks.push(chunk.subarray(0, bytesRead))
      length += bytesRead
    }
    return new Uint8Array(Buffer.concat(chunks, length))
  } finally {
    await handle.close()
  }
}

// CoreDeps.toPng and CoreDeps.webpToPng.
export type PictureConverters = {
  toPng: (bytes: Uint8Array) => Uint8Array
  webpToPng: (bytes: Uint8Array) => Promise<Uint8Array>
}

const sideFits = (side: number) => side > 0 && side <= MAX_PICTURE_SIDE

// A WebP's header is read and its size checked before the window sees it. The window's
// answer must be a PNG of the size the header stated.
async function webpAsPng(bytes: Uint8Array, convert: PictureConverters): Promise<Uint8Array> {
  const { width, height } = webpInfo(bytes)
  if (!sideFits(width) || !sideFits(height) || width * height > MAX_PICTURE_PIXELS)
    throw new Error('The WebP is over the picture limits')
  const png = await convert.webpToPng(bytes)
  const size = pngPixelSize(png)
  if (size.width !== width || size.height !== height) throw new Error('The PNG has another size')
  return png
}

// Every refusal from a converter is asset_not_a_picture; a PNG over the limit, at either
// step, is asset_too_large. Nothing the file carries beside the picture reaches the reply.
async function cleanPng(
  bytes: Uint8Array,
  displayName: string,
  maxBytes: number,
  convert: PictureConverters,
): Promise<ImageFile> {
  const step = async <T>(run: () => T | Promise<T>): Promise<T> => {
    try {
      return await run()
    } catch {
      throw notAPicture(displayName)
    }
  }
  const isWebp = hasWebpSignature(bytes)
  if (!isWebp && !pictureType(bytes)) throw notAPicture(displayName)
  const png = isWebp ? await step(() => webpAsPng(bytes, convert)) : bytes
  if (png.length > maxBytes) throw tooLarge(displayName)
  const clean = await step(() => convert.toPng(png))
  if (pictureType(clean) !== 'image/png') throw notAPicture(displayName)
  if (clean.length > maxBytes) throw tooLarge(displayName)
  return { bytes: clean, mime: 'image/png' }
}

// Without converters (the asset service on its own, in tests) the bytes are handed on as
// read, and a WebP is refused.
export async function readPicture(
  file: string,
  displayName: string,
  maxBytes: number,
  convert?: PictureConverters,
): Promise<ImageFile> {
  if ((await fs.promises.stat(file)).size > maxBytes) throw tooLarge(displayName)
  const bytes = await readAtMost(file, maxBytes)
  if (bytes.length > maxBytes) throw tooLarge(displayName)
  if (convert) return cleanPng(bytes, displayName, maxBytes, convert)
  const mime = pictureType(bytes)
  if (!mime) throw notAPicture(displayName)
  return { bytes, mime }
}
