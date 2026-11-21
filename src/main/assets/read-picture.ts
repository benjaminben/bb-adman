// SPEC 14 [1.25] point 7, [1.27] R2 (security class): AssetService.read loads a file into
// memory and its result is sent to a provider. The size is checked before any byte is read
// and again on the bytes read; the type comes from the bytes, never from the row.
import fs from 'node:fs'
import { MAX_PICTURE_BYTES } from '../providers/picture-limits'
import { pictureType } from '../providers/picture-type'
import { AppError } from '../../shared/schemas/result'
import type { ImageFile } from '../providers/types'

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

export async function readPicture(
  file: string,
  displayName: string,
  maxBytes: number,
): Promise<ImageFile> {
  if ((await fs.promises.stat(file)).size > maxBytes) throw tooLarge(displayName)
  const bytes = await readAtMost(file, maxBytes)
  if (bytes.length > maxBytes) throw tooLarge(displayName)
  const mime = pictureType(bytes)
  if (!mime) throw notAPicture(displayName)
  return { bytes, mime }
}
