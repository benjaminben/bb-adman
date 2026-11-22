// Opens one file for an upload (spec/phases/phase-09.md "Publishing", uploads; spec/security.md
// "Rules: files and paths"). The check is made when the stream is first read, not when it is
// made, so each attempt checks again: `root` must be a real folder, not a link, and its own real
// path (as src/main/export/target.ts checks its root); the file a regular file with one name
// (no link, no hard link), its real path inside `root`, and the file opened the one checked
// (same device and inode). A refusal is LocalFileRefused, whose message holds no path.
import fs from 'node:fs/promises'
import type { FileHandle } from 'node:fs/promises'
import { pathInside } from '@/main/assets/path-resolver'

const CHUNK = 64 * 1024

export class LocalFileRefused extends Error {
  constructor() {
    super('A file to upload was refused')
    this.name = 'LocalFileRefused'
  }
}

async function checkRoot(root: string): Promise<void> {
  const stats = await fs.lstat(root)
  if (!stats.isDirectory() || (await fs.realpath(root)) !== root) throw new LocalFileRefused()
}

async function openChecked(root: string, file: string): Promise<FileHandle> {
  await checkRoot(root)
  const before = await fs.lstat(file)
  if (!before.isFile() || before.nlink !== 1) throw new LocalFileRefused()
  const realFile = await fs.realpath(file)
  if (pathInside(root, realFile) === null) throw new LocalFileRefused()
  const handle = await fs.open(realFile, 'r')
  const opened = await handle.stat().catch(() => null)
  const same = opened?.ino === before.ino && opened.dev === before.dev
  if (!opened?.isFile() || !same || opened.nlink !== 1) {
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
