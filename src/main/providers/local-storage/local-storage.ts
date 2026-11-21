// SPEC 6, 6.5: StorageProvider on a local folder. Used by export and by tests (there is no
// separate fake storage). It never touches anything outside `root`: every path passes the
// shared path rules, and the real folder it lands in, after links are followed, must still be
// inside the real root. Every disk error leaves as a ProviderFailure with the code only.
import fs from 'node:fs/promises'
import nodePath from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createWriteStream } from 'node:fs'
import type { ReadableStream as WebReadableStream } from 'node:stream/web'
import type { StorageProvider } from '../types'
import { notThere, onDisk } from './failure'
import { refusePath, storageFilePath, storageListPrefix } from './paths'

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT'
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
      else if (entry.isFile()) found.push(child)
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
        if (data instanceof Uint8Array) {
          await fs.writeFile(file, data)
          return
        }
        await pipeline(Readable.fromWeb(data as WebReadableStream), createWriteStream(file))
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
