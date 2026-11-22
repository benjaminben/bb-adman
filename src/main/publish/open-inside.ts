// Opens one file for an upload (spec/phases/phase-09.md "Publishing", uploads; spec/security.md
// "Rules: files and paths"). The check is made when the stream is first read, not when it is
// made, so each attempt checks again: the file must be a regular file, not a link, its real
// path inside the real path of `root`, and the file opened must be the one checked (same
// device and inode). A refusal is LocalFileRefused, whose message holds no path.
import fs from 'node:fs/promises'
import type { FileHandle } from 'node:fs/promises'
import path from 'node:path'

const CHUNK = 64 * 1024

export class LocalFileRefused extends Error {
  constructor() {
    super('A file to upload was refused')
    this.name = 'LocalFileRefused'
  }
}

function isInside(root: string, file: string): boolean {
  const rel = path.relative(root, file)
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)
}

async function openChecked(root: string, file: string): Promise<FileHandle> {
  const before = await fs.lstat(file)
  if (!before.isFile()) throw new LocalFileRefused()
  const [realRoot, realFile] = await Promise.all([fs.realpath(root), fs.realpath(file)])
  if (!isInside(realRoot, realFile)) throw new LocalFileRefused()
  const handle = await fs.open(realFile, 'r')
  const opened = await handle.stat().catch(() => null)
  if (!opened?.isFile() || opened.ino !== before.ino || opened.dev !== before.dev) {
    await handle.close()
    throw new LocalFileRefused()
  }
  return handle
}

// The bytes of `file`, a main-process path the caller listed, read only if it is inside `root`.
export function openFileInside(root: string, file: string): ReadableStream<Uint8Array> {
  let handle: FileHandle | null = null
  const close = async () => {
    const open = handle
    handle = null
    await open?.close().catch(() => undefined)
  }
  return new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        try {
          handle ??= await openChecked(root, file)
          const buffer = new Uint8Array(CHUNK)
          const { bytesRead } = await handle.read(buffer, 0, CHUNK, null)
          if (bytesRead === 0) {
            await close()
            controller.close()
          } else {
            controller.enqueue(buffer.subarray(0, bytesRead))
          }
        } catch (error) {
          await close()
          throw error instanceof LocalFileRefused ? error : new LocalFileRefused()
        }
      },
      cancel: close,
    },
    { highWaterMark: 0 },
  )
}
