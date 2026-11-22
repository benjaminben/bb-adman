// R2P-5b: the one read of a file an agent named and the user allowed. The shown path is opened
// once without following a last-part link; the open file must be the regular file lstat saw
// (same device and inode), and the shown path must still be its own real path after the open.
// Its type and hash come from the bytes read through that one handle, so a link swapped in at
// the path cannot put other bytes under the checks.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { FileType } from '@/shared/config/file-types'
import { sniffType, SNIFF_BYTES } from './sniff'
import { videoFileFacts } from './video-file-facts'

export type CheckedFile = { type: FileType | undefined; contentHash: string }

// Not on Windows, which has no such flag; there the inode compare and the real path stand.
const NO_FOLLOW = fs.constants.O_NOFOLLOW ?? 0

// A file that is not the one lstat saw, or no longer at its own real path.
export class SwappedFileError extends Error {}

async function headOf(handle: fs.promises.FileHandle, size: number): Promise<Uint8Array> {
  const buffer = new Uint8Array(Math.min(size, SNIFF_BYTES))
  const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
  return buffer.subarray(0, bytesRead)
}

async function hashOf(handle: fs.promises.FileHandle): Promise<string> {
  const hash = crypto.createHash('sha256')
  for await (const chunk of handle.createReadStream({ start: 0, autoClose: false })) {
    hash.update(chunk as Buffer)
  }
  return hash.digest('hex')
}

// The type as a person's import finds it: name and first bytes, and for an MP4 or MOV a
// readable video track (inspect.ts, checkVideo).
async function typeOf(handle: fs.promises.FileHandle, shown: string, size: number) {
  const type = sniffType(path.basename(shown), await headOf(handle, size))
  if (type?.id !== 'mp4' && type?.id !== 'mov') return type
  return (await videoFileFacts(handle)) ? type : undefined
}

// Opens `shown` and reads it, or throws SwappedFileError, or the system's own error.
// `stillShown` tells whether the shown path is still its own real path.
export async function readCheckedFile(
  shown: string,
  seen: fs.Stats,
  stillShown: () => Promise<boolean>,
): Promise<CheckedFile> {
  const handle = await fs.promises.open(shown, fs.constants.O_RDONLY | NO_FOLLOW)
  try {
    const stat = await handle.stat()
    const same = stat.isFile() && stat.dev === seen.dev && stat.ino === seen.ino
    if (!same || !(await stillShown())) throw new SwappedFileError()
    return { type: await typeOf(handle, shown, stat.size), contentHash: await hashOf(handle) }
  } finally {
    await handle.close()
  }
}

// The SHA-256 of a finished copy, read without following a link.
export async function hashOfCopy(file: string): Promise<string> {
  const handle = await fs.promises.open(file, fs.constants.O_RDONLY | NO_FOLLOW)
  try {
    return await hashOf(handle)
  } finally {
    await handle.close()
  }
}
