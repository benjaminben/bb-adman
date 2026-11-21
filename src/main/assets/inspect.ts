// Reads what an asset row stores about a file (SPEC 3.3 asset): type from the bytes, size,
// time, SHA-256 and, for PNG and JPEG, the pixel size from the header. Imported files are
// untrusted: the hash is streamed, and only the first bytes are held in memory.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { sniffType, SNIFF_BYTES } from './sniff'
import { pictureSize } from '../providers/picture-size'
import { extensionOf, type FileType } from '../../shared/config/file-types'
import { AppError } from '../../shared/schemas/result'

// A JPEG's frame header can sit after a large EXIF block, so more than SNIFF_BYTES is read.
const HEADER_BYTES = 256 * 1024

export type InspectedFile = {
  file: string
  fileName: string
  ext: string
  type: FileType
  byteSize: number
  mtimeMs: number
  contentHash: string
  width: number | null
  height: number | null
}

async function readHead(file: string, length: number): Promise<Uint8Array> {
  const handle = await fs.promises.open(file, 'r')
  try {
    const buffer = new Uint8Array(length)
    const { bytesRead } = await handle.read(buffer, 0, length, 0)
    return buffer.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
}

export async function hashFile(file: string): Promise<string> {
  const hash = crypto.createHash('sha256')
  await pipeline(fs.createReadStream(file), hash)
  return hash.digest('hex')
}

function pixelSize(type: FileType, head: Uint8Array): { width: number; height: number } | null {
  if (type.mime !== 'image/png' && type.mime !== 'image/jpeg') return null
  try {
    return pictureSize(head, type.mime)
  } catch {
    return null
  }
}

async function statFile(file: string, fileName: string): Promise<fs.Stats> {
  if (!path.isAbsolute(file)) {
    throw new AppError('INVALID_INPUT', 'Choose each file by its full path.')
  }
  const stat = await fs.promises.stat(file).catch((e: NodeJS.ErrnoException) => {
    if (e.code === 'ENOENT' || e.code === 'ENOTDIR') {
      throw new AppError('NOT_FOUND', `${fileName} was not found.`)
    }
    throw e
  })
  if (!stat.isFile()) throw new AppError('INVALID_INPUT', 'Choose files, not a folder.')
  return stat
}

// The file's facts, or a refusal whose message names the file and never its path.
export async function inspectFile(given: string): Promise<InspectedFile> {
  const fileName = path.basename(given)
  const stat = await statFile(given, fileName)
  const file = path.resolve(given)
  const head = await readHead(file, Math.min(stat.size, HEADER_BYTES))
  const type = sniffType(fileName, head.subarray(0, SNIFF_BYTES))
  if (!type) throw new AppError('INVALID_INPUT', `${fileName} is not a file type the app accepts.`)
  const size = pixelSize(type, head)
  return {
    file,
    fileName,
    ext: extensionOf(fileName),
    type,
    byteSize: stat.size,
    mtimeMs: Math.trunc(stat.mtimeMs),
    contentHash: await hashFile(file),
    width: size?.width ?? null,
    height: size?.height ?? null,
  }
}
