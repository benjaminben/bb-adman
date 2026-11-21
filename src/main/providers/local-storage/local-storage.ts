// SPEC 6, 6.5: StorageProvider on a local folder. Used by export and by tests (there is no
// separate fake storage). It never touches anything outside `root`: every path passes the
// shared path rules, and the real folder it lands in, after links are followed, must still be
// inside the real root.
import fs from 'node:fs/promises'
import nodePath from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createWriteStream } from 'node:fs'
import type { ReadableStream as WebReadableStream } from 'node:stream/web'
import type { StorageProvider } from '../types'
import { refusePath, storageFilePath, storageListPrefix } from './paths'

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT'
}

export function localStorageAt(root: string): StorageProvider {
  const absoluteRoot = nodePath.resolve(root)

  // The real folder at `relative` (parts joined by '/'), checked to be inside the real root.
  // Folders are made first when `make` is true; otherwise null when one is missing.
  async function folderFor(relative: string, make: boolean): Promise<string | null> {
    const folder = nodePath.join(absoluteRoot, ...relative.split('/'))
    if (make) await fs.mkdir(folder, { recursive: true })
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
      refusePath(relative)
    }
    return realFolder
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
    if (link) refusePath(relative)
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
    async exists(path) {
      const file = await fileFor(path, false)
      if (file === null) return false
      try {
        return (await fs.stat(file)).isFile()
      } catch (error) {
        if (isMissing(error)) return false
        throw error
      }
    },

    async read(path) {
      const file = await fileFor(path, false)
      if (file === null) throw new Error(`Storage file not found: ${JSON.stringify(path)}`)
      return new Uint8Array(await fs.readFile(file))
    },

    async write(path, data) {
      const file = await fileFor(path, true)
      if (file === null)
        throw new Error(`Storage folder could not be made: ${JSON.stringify(path)}`)
      if (data instanceof Uint8Array) {
        await fs.writeFile(file, data)
        return
      }
      await pipeline(Readable.fromWeb(data as WebReadableStream), createWriteStream(file))
    },

    async list(prefix) {
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
    },

    async remove(paths) {
      const files = []
      for (const path of paths) files.push(await fileFor(path, false))
      for (const file of files) if (file !== null) await fs.rm(file, { force: true })
    },
  }
}
