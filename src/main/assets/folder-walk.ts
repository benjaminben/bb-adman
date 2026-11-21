// Folder import (SPEC 14, Slice A rulings point 5, A3-3 and [1.29] T1; FR-050). A path that
// is a folder stands for the regular files in it and in its subfolders, at most 12 levels
// below it, sorted by relative path. Inside a folder (security class) a link is never
// followed: each entry is checked with lstat. Dot entries, links, folders past the depth
// limit, folders that cannot be listed and anything that is not a regular file are skipped
// and counted. A path the user named directly is passed on as it is.
import fs from 'node:fs'
import path from 'node:path'
import { AppError } from '../../shared/schemas/result'
import { UnreadableFileError } from './unreadable'

// Decided: D-053 item 19 (SPEC 14, 1.39 Z1).
export const FOLDER_LIMITS = { maxDepth: 12, maxFiles: 500 }

export type ImportPath = { file: string; inFolder: boolean }
export type ExpandedPaths = { paths: ImportPath[]; skippedCount: number }

type Found = { rel: string; file: string }
type Tally = { files: number; skipped: number }

function countFile(tally: Tally): void {
  tally.files += 1
  if (tally.files <= FOLDER_LIMITS.maxFiles) return
  throw new AppError(
    'INVALID_INPUT',
    `That is too many files for one import. The limit is ${FOLDER_LIMITS.maxFiles}.`,
    { reason: 'too_many_files' },
  )
}

async function isFolder(given: string): Promise<boolean> {
  if (!path.isAbsolute(given)) return false
  try {
    return (await fs.promises.stat(given)).isDirectory()
  } catch {
    return false
  }
}

async function entryKind(file: string): Promise<'file' | 'folder' | 'other'> {
  try {
    const stat = await fs.promises.lstat(file)
    if (stat.isFile()) return 'file'
    return stat.isDirectory() ? 'folder' : 'other'
  } catch {
    return 'other'
  }
}

async function walk(dir: string, rel: string, depth: number, tally: Tally, out: Found[]) {
  let names: string[]
  try {
    names = await fs.promises.readdir(dir)
  } catch (e) {
    if (depth === 0) {
      throw new UnreadableFileError(path.basename(dir), (e as NodeJS.ErrnoException).code)
    }
    tally.skipped += 1
    return
  }
  for (const name of names) {
    const file = path.join(dir, name)
    const relName = rel === '' ? name : `${rel}/${name}`
    const kind = name.startsWith('.') ? 'other' : await entryKind(file)
    if (kind === 'file') {
      countFile(tally)
      out.push({ rel: relName, file })
    } else if (kind === 'folder' && depth < FOLDER_LIMITS.maxDepth) {
      await walk(file, relName, depth + 1, tally, out)
    } else {
      tally.skipped += 1
    }
  }
}

// UTF-8 byte order is code point order.
const byCodePoint = (a: Found, b: Found) => Buffer.compare(Buffer.from(a.rel), Buffer.from(b.rel))

// The files to import, in order, before any file is read; too_many_files over the limit.
export async function expandPaths(given: string[]): Promise<ExpandedPaths> {
  const tally: Tally = { files: 0, skipped: 0 }
  const paths: ImportPath[] = []
  for (const p of given) {
    if (!(await isFolder(p))) {
      countFile(tally)
      paths.push({ file: p, inFolder: false })
      continue
    }
    const found: Found[] = []
    await walk(path.resolve(p), '', 0, tally, found)
    found.sort(byCodePoint)
    for (const f of found) paths.push({ file: f.file, inFolder: true })
  }
  return { paths, skippedCount: tally.skipped }
}
