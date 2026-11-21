// SPEC 6, 6.5: StorageProvider on a local folder. Used by export and by tests (there is no
// separate fake storage). It never touches anything outside `root`: every path passes the
// shared path rules, and the real folder it lands in, after links are followed, must still be
// inside the real root. Every disk error leaves as a ProviderFailure with the code only.
import fs from 'node:fs/promises'
import nodePath from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream as WebReadableStream } from 'node:stream/web'
import type { StorageProvider } from '@/main/providers/types'
import { notThere, onDisk } from './failure'
import { refusePath, storageFilePath, storageListPrefix } from '@/main/providers/storage-paths'

// [1.14] H13: not there, a path through a file (`ENOTDIR`) included.
function isMissing(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code
  return code === 'ENOENT' || code === 'ENOTDIR'
}

// spec/phases/phase-08.md "The output folder" [A-194]: every write goes to {name}.partial and
// is renamed to {name}, so a reader never sees half a file.
const PARTIAL = '.partial'

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

// `file` was checked by fileFor: inside the real root and not a link. A failed write removes
// the .partial it made and leaves any older file of the name whole.
async function writeThroughPartial(file: string, data: ReadableStream | Uint8Array) {
  const partial = `${file}${PARTIAL}`
  await clearLeftover(partial)
  const handle = await fs.open(partial, 'wx')
  try {
    if (data instanceof Uint8Array) await handle.writeFile(data)
    else await pipeline(Readable.fromWeb(data as WebReadableStream), handle.createWriteStream())
    await handle.close()
    await fs.rename(partial, file)
  } catch (error) {
    await handle.close().catch(() => undefined)
    await fs.rm(partial, { force: true })
    throw error
  }
}

export function localStorageAt(root: string): StorageProvider {
  const absoluteRoot = nodePath.resolve(root)

  // The real path of `folder`, refused unless it is inside the real root. Null when missing.
  async function realInside(folder: string): Promise<string | null> {
    let realRoot: string
    let realFolder: string
    try {
      realRoot = await fs.realpath(absoluteRoot)
      realFolder = await fs.realpath(folder)
    } catch (error) {
      if (isMissing(error)) return null
      throw error
    }
    if (realFolder !== realRoot && !realFolder.startsWith(realRoot + nodePath.sep)) {
      refusePath()
    }
    return realFolder
  }

  // SPEC 14 H9: before any folder is made, the deepest folder that already exists must be
  // inside the real root. The root itself is the caller's own folder and may be made.
  async function checkBeforeMaking(parts: string[]): Promise<void> {
    await fs.mkdir(absoluteRoot, { recursive: true })
    for (let depth = parts.length; depth >= 0; depth -= 1) {
      const folder = nodePath.join(absoluteRoot, ...parts.slice(0, depth))
      if ((await realInside(folder)) !== null) return
    }
  }

  // SPEC 6.5 [1.16] A-02, H17: on the way down, any part that is a link whose target does not
  // exist is refused. The walk stops at the first part that is not there.
  async function refuseLinksToNowhere(parts: string[]): Promise<void> {
    for (let depth = 1; depth <= parts.length; depth += 1) {
      const part = nodePath.join(absoluteRoot, ...parts.slice(0, depth))
      let stats
      try {
        stats = await fs.lstat(part)
      } catch (error) {
        if (isMissing(error)) return
        throw error
      }
      if (stats.isSymbolicLink()) {
        await fs.stat(part).catch((error: unknown) => {
          if (isMissing(error)) refusePath()
          throw error
        })
      }
    }
  }

  // The real folder at `relative` (parts joined by '/'), checked to be inside the real root.
  // When `make` is true the missing folders are made after the check, then checked again;
  // otherwise null when one is missing.
  async function folderFor(relative: string, make: boolean): Promise<string | null> {
    const parts = relative === '' ? [] : relative.split('/')
    const folder = nodePath.join(absoluteRoot, ...parts)
    await refuseLinksToNowhere(parts)
    if (make) {
      await checkBeforeMaking(parts)
      await fs.mkdir(folder, { recursive: true })
    }
    return realInside(folder)
  }

  async function fileFor(path: string, make: boolean): Promise<string | null> {
    const relative = storageFilePath(path)
    const parts = relative.split('/')
    const name = parts.pop() ?? relative
    const folder = await folderFor(parts.join('/'), make)
    if (folder === null) return null
    const file = nodePath.join(folder, name)
    // A link at the file itself could point anywhere, so it is refused.
    const link = await fs.lstat(file).then(
      (stats) => stats.isSymbolicLink(),
      (error: unknown) => {
        if (isMissing(error)) return false
        throw error
      },
    )
    if (link) refusePath()
    return file
  }

  async function walk(folder: string, relative: string, found: string[]): Promise<void> {
    let entries
    try {
      entries = await fs.readdir(folder, { withFileTypes: true })
    } catch (error) {
      if (isMissing(error)) return
      throw error
    }
    for (const entry of entries) {
      const child = `${relative}${entry.name}`
      if (entry.isDirectory()) await walk(nodePath.join(folder, entry.name), `${child}/`, found)
      else if (entry.isFile() && !entry.name.endsWith(PARTIAL)) found.push(child)
    }
  }

  return {
    exists: (path) =>
      onDisk(async () => {
        const file = await fileFor(path, false)
        if (file === null) return false
        try {
          return (await fs.stat(file)).isFile()
        } catch (error) {
          if (isMissing(error)) return false
          throw error
        }
      }),

    read: (path) =>
      onDisk(async () => {
        const file = await fileFor(path, false)
        if (file === null) throw notThere()
        return new Uint8Array(await fs.readFile(file))
      }),

    write: (path, data) =>
      onDisk(async () => {
        const file = await fileFor(path, true)
        if (file === null) throw notThere()
        await writeThroughPartial(file, data)
      }),

    list: (prefix) =>
      onDisk(async () => {
        const folder = storageListPrefix(prefix)
        const found: string[] = []
        if (folder !== '') {
          const real = await folderFor(folder.slice(0, -1), false)
          if (real === null) return []
          await walk(real, folder, found)
        } else {
          await walk(absoluteRoot, '', found)
        }
        return found
      }),

    remove: (paths) =>
      onDisk(async () => {
        const files = []
        for (const path of paths) files.push(await fileFor(path, false))
        for (const file of files) if (file !== null) await fs.rm(file, { force: true })
      }),
  }
}
