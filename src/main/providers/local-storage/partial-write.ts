// spec/phases/phase-08.md "The output folder" [A-194]: every local write goes to
// {name}.partial and then to {name}, so a reader never sees half a file. `file` is always a
// path fileFor checked: inside the real root and not a link.
import fs from 'node:fs/promises'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream as WebReadableStream } from 'node:stream/web'
import { refusePath } from '@/main/providers/storage-paths'

export const PARTIAL = '.partial'

const codeOf = (error: unknown) => (error as NodeJS.ErrnoException).code

// [1.14] H13: not there, a path through a file (`ENOTDIR`) included.
export function isMissing(error: unknown): boolean {
  const code = codeOf(error)
  return code === 'ENOENT' || code === 'ENOTDIR'
}

// A leftover .partial that is a regular file is removed; a link there is refused, so nothing
// is written through it. Anything else stays and makes the `wx` open fail.
async function clearLeftover(partial: string): Promise<void> {
  const stats = await fs.lstat(partial).catch((error: unknown) => {
    if (isMissing(error)) return null
    throw error
  })
  if (stats?.isSymbolicLink()) refusePath()
  if (stats?.isFile()) await fs.rm(partial)
}

// Writes the whole of `data` to a new {file}.partial. On a failure the .partial is removed.
async function fillPartial(file: string, data: ReadableStream | Uint8Array): Promise<string> {
  const partial = `${file}${PARTIAL}`
  await clearLeftover(partial)
  const handle = await fs.open(partial, 'wx')
  try {
    if (data instanceof Uint8Array) await handle.writeFile(data)
    else await pipeline(Readable.fromWeb(data as WebReadableStream), handle.createWriteStream())
    await handle.close()
  } catch (error) {
    await handle.close().catch(() => undefined)
    await fs.rm(partial, { force: true })
    throw error
  }
  return partial
}

// Replaces a regular file of the name. A failed write leaves any older file of the name whole.
export async function writeThroughPartial(file: string, data: ReadableStream | Uint8Array) {
  const partial = await fillPartial(file, data)
  try {
    await fs.rename(partial, file)
  } catch (error) {
    await fs.rm(partial, { force: true })
    throw error
  }
}

// A-193: puts the file at the name only if nothing is there; false when the name is taken (a
// file, a folder or a link). A hard link fails on a taken name; a disk without hard links
// falls back to a copy that also refuses one.
async function placeNew(partial: string, file: string): Promise<boolean> {
  try {
    await fs.link(partial, file)
    return true
  } catch (error) {
    if (codeOf(error) === 'EEXIST') return false
  }
  try {
    await fs.copyFile(partial, file, fs.constants.COPYFILE_EXCL)
    return true
  } catch (error) {
    if (codeOf(error) === 'EEXIST') return false
    throw error
  }
}

// Never replaces anything. The .partial is removed whatever the outcome.
export async function writeNewThroughPartial(
  file: string,
  data: ReadableStream | Uint8Array,
): Promise<boolean> {
  const partial = await fillPartial(file, data)
  try {
    return await placeNew(partial, file)
  } finally {
    await fs.rm(partial, { force: true })
  }
}
