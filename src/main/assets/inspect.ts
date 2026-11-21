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
import { UnreadableFileError } from './unreadable'

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

// The same facts for a file of no accepted type, which a caller may refuse or skip.
export type FileFacts = Omit<InspectedFile, 'type'> & { type: FileType | undefined }

async function headOf(handle: fs.promises.FileHandle, length: number): Promise<Uint8Array> {
  const buffer = new Uint8Array(length)
  const { bytesRead } = await handle.read(buffer, 0, length, 0)
  return buffer.subarray(0, bytesRead)
}

async function readHead(file: string, length: number): Promise<Uint8Array> {
  const handle = await fs.promises.open(file, 'r')
  try {
    return await headOf(handle, length)
  } finally {
    await handle.close()
  }
}

// The accepted type of a file from its base name and first bytes, as import checks it, or
// undefined when it does not match or cannot be read (SPEC 14 [1.30] U4).
export async function sniffFile(file: string): Promise<FileType | undefined> {
  try {
    return sniffType(path.basename(file), await readHead(file, SNIFF_BYTES))
  } catch {
    return undefined
  }
}

async function hashOf(stream: NodeJS.ReadableStream): Promise<string> {
  const hash = crypto.createHash('sha256')
  await pipeline(stream, hash)
  return hash.digest('hex')
}

export async function hashFile(file: string): Promise<string> {
  return hashOf(fs.createReadStream(file))
}

function pixelSize(
  type: FileType | undefined,
  head: Uint8Array,
): { width: number; height: number } | null {
  if (!type) return null
  if (type.mime !== 'image/png' && type.mime !== 'image/jpeg') return null
  try {
    return pictureSize(head, type.mime)
  } catch {
    return null
  }
}

// SPEC 14, Slice A rulings point 6: a file that is not there is NOT_FOUND; any other error
// from stat, open, read or hashing is file_not_readable. Neither message holds the path.
function fileError(e: unknown, fileName: string): unknown {
  if (e instanceof AppError) return e
  const code = (e as NodeJS.ErrnoException | null)?.code
  if (code === 'ENOENT' || code === 'ENOTDIR') {
    return new AppError('NOT_FOUND', `${fileName} was not found.`)
  }
  return new UnreadableFileError(fileName, code)
}

// The file's facts, or a refusal whose message names the file and never its path.
export async function readFileFacts(given: string): Promise<FileFacts> {
  const fileName = path.basename(given)
  if (!path.isAbsolute(given)) {
    throw new AppError('INVALID_INPUT', 'Choose each file by its full path.')
  }
  try {
    return await readFacts(path.resolve(given), fileName)
  } catch (e) {
    throw fileError(e, fileName)
  }
}

// As readFileFacts, and a file of no accepted type is refused.
export async function inspectFile(given: string): Promise<InspectedFile> {
  const facts = await readFileFacts(given)
  const { type } = facts
  if (!type) {
    throw new AppError('INVALID_INPUT', `${facts.fileName} is not a file type the app accepts.`)
  }
  return { ...facts, type }
}

// Not on Windows, which has no such flag; there the entry's lstat is the only check.
const NO_FOLLOW = fs.constants.O_NOFOLLOW ?? 0

// A file found inside a folder (SPEC 14, [1.29] T1), or null when it is skipped: no
// accepted type, empty, or not readable. The type is decided from the first bytes before
// the file is hashed, so a skipped file is never read whole. It is opened without following
// a link, in case one took its place after the folder was listed.
export async function inspectFolderFile(file: string): Promise<InspectedFile | null> {
  const fileName = path.basename(file)
  let handle: fs.promises.FileHandle
  try {
    handle = await fs.promises.open(file, fs.constants.O_RDONLY | NO_FOLLOW)
  } catch {
    return null
  }
  try {
    const stat = await handle.stat()
    if (!stat.isFile()) return null
    const type = sniffType(fileName, await headOf(handle, Math.min(stat.size, SNIFF_BYTES)))
    if (!type) return null
    const head = await headOf(handle, Math.min(stat.size, HEADER_BYTES))
    const hash = await hashOf(handle.createReadStream({ start: 0, autoClose: false }))
    return factsOf(file, stat, type, head, hash)
  } catch {
    return null
  } finally {
    await handle.close()
  }
}

function factsOf<T extends FileType | undefined>(
  file: string,
  stat: fs.Stats,
  type: T,
  head: Uint8Array,
  contentHash: string,
) {
  const fileName = path.basename(file)
  const size = pixelSize(type, head)
  return {
    file,
    fileName,
    ext: extensionOf(fileName),
    type,
    byteSize: stat.size,
    mtimeMs: Math.trunc(stat.mtimeMs),
    contentHash,
    width: size?.width ?? null,
    height: size?.height ?? null,
  }
}

async function readFacts(file: string, fileName: string): Promise<FileFacts> {
  const stat = await fs.promises.stat(file)
  if (!stat.isFile()) throw new AppError('INVALID_INPUT', 'Choose files, not a folder.')
  const head = await readHead(file, Math.min(stat.size, HEADER_BYTES))
  const type = sniffType(fileName, head.subarray(0, SNIFF_BYTES))
  return factsOf(file, stat, type, head, await hashFile(file))
}
