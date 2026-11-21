// spec/scene.md, "Thumbnails": reads, writes and cleans thumbnail files. Security class: every
// name goes through paths.ts first, and files are touched only directly inside a project folder
// that is a real folder (not a link) whose real path is inside {userData}/thumbnails/.
import fs from 'node:fs/promises'
import path from 'node:path'
import { PARTIAL_NAME, THUMBNAIL_NAME, thumbnailDir, thumbnailName, thumbnailsRoot } from './paths'

export const MAX_THUMBNAIL_BYTES = 8 * 1024 * 1024

async function lstatOrNull(p: string) {
  try {
    return await fs.lstat(p)
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw e
  }
}

// A folder that is absent is made when asked; one that is there must be a real folder.
async function realFolder(p: string, create: boolean): Promise<boolean> {
  let stat = await lstatOrNull(p)
  if (!stat && create) {
    await fs.mkdir(p, { recursive: true })
    stat = await lstatOrNull(p)
  }
  return !!stat && stat.isDirectory() && !stat.isSymbolicLink()
}

// The project's thumbnail folder after every check, or null when one fails or it is absent.
async function projectFolder(
  userDataDir: string,
  projectId: string,
  create: boolean,
): Promise<string | null> {
  const dir = thumbnailDir(userDataDir, projectId)
  const root = thumbnailsRoot(userDataDir)
  if (!(await realFolder(root, create))) return null
  if (!(await realFolder(dir, create))) return null
  const [realRoot, realDir] = await Promise.all([fs.realpath(root), fs.realpath(dir)])
  return realDir === path.join(realRoot, projectId) ? dir : null
}

export async function readThumbnail(
  userDataDir: string,
  projectId: string,
  variantId: string,
  rev: number,
): Promise<Uint8Array | null> {
  const name = thumbnailName(variantId, rev)
  const dir = await projectFolder(userDataDir, projectId, false)
  if (!dir) return null
  const file = path.join(dir, name)
  const stat = await lstatOrNull(file)
  if (!stat || !stat.isFile() || stat.size > MAX_THUMBNAIL_BYTES) return null
  return new Uint8Array(await fs.readFile(file))
}

// Written to {name}.partial with the wx flag, then renamed over the name.
export async function writeThumbnail(
  userDataDir: string,
  projectId: string,
  variantId: string,
  rev: number,
  png: Uint8Array,
): Promise<'written' | 'kept' | 'refused'> {
  const name = thumbnailName(variantId, rev)
  const dir = await projectFolder(userDataDir, projectId, true)
  if (!dir) return 'refused'
  const file = path.join(dir, name)
  if (await lstatOrNull(file)) return 'kept'
  const partial = `${file}.partial`
  await fs.writeFile(partial, png, { flag: 'wx' })
  await fs.rename(partial, file)
  return 'written'
}

// Deletes the thumbnail for one rev when it is a regular file. True when one was deleted.
export async function removeThumbnail(
  userDataDir: string,
  projectId: string,
  variantId: string,
  rev: number,
): Promise<boolean> {
  const name = thumbnailName(variantId, rev)
  const dir = await projectFolder(userDataDir, projectId, false)
  if (!dir) return false
  return deleteRegular(path.join(dir, name))
}

// Project close: deletes each regular file directly in the folder whose name is a thumbnail or
// a half-written one, unless it is in keep. Returns how many were deleted.
export async function cleanThumbnails(
  userDataDir: string,
  projectId: string,
  keep: ReadonlySet<string>,
): Promise<number> {
  const dir = await projectFolder(userDataDir, projectId, false)
  if (!dir) return 0
  let count = 0
  for (const name of await fs.readdir(dir)) {
    if (keep.has(name) || !(THUMBNAIL_NAME.test(name) || PARTIAL_NAME.test(name))) continue
    if (await deleteRegular(path.join(dir, name))) count++
  }
  return count
}

async function deleteRegular(file: string): Promise<boolean> {
  const stat = await lstatOrNull(file)
  if (!stat || !stat.isFile()) return false
  await fs.unlink(file)
  return true
}
