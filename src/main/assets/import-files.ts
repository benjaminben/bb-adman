// asset.importFiles, the file side (spec/phases/round-2-platform.md, D5; A-348 to A-352).
// Before the ask only the text rules run (file-path-text.ts), so nothing on disk is touched.
// After the user allowed, each shown path is checked again on disk: its real path must be the
// shown path (no link anywhere on the way), it must be a regular file, and it is then opened
// once and read through that handle (checked-file.ts, R2P-5b) for its type and hash. Then every
// file is copied (never linked) by prepareImport, which checks type, size and decode as for a
// person's import, and each finished copy must hold the bytes the handle read. Every refusal
// names the file by its place in the list; the asset code's own errors, which hold file names
// and paths, never get out.
import fs from 'node:fs'
import { AppError } from '@/shared/schemas/result'
import { checkPathTexts, MEDIA_KINDS, pathTextMessage } from '@/shared/assets/file-path-text'
import type { FileType } from '@/shared/config/file-types'
import type { ProjectHandle } from '@/main/db/project-file'
import { prepareImport, removeCopies, type PreparedImport } from './import'
import { hashOfCopy, readCheckedFile, SwappedFileError, type CheckedFile } from './checked-file'
import { UnreadableFileError } from './unreadable'

// The normalised paths the user is shown, or INVALID_INPUT with { reason, index }.
export function importPathTexts(paths: readonly string[], platform = process.platform): string[] {
  const checked = checkPathTexts(paths, platform)
  if (checked.ok) return checked.paths
  throw new AppError('INVALID_INPUT', pathTextMessage(checked.refusal), { ...checked.refusal })
}

// macOS and Windows compare paths without letter case, as their disks do by default.
export function samePath(a: string, b: string, platform = process.platform): boolean {
  if (platform === 'darwin' || platform === 'win32') return a.toLowerCase() === b.toLowerCase()
  return a === b
}

const notFound = (n: number) =>
  new AppError('NOT_FOUND', `File ${n} was not found.`, { reason: 'file_not_found' })

const rule = (n: number, reason: string, words: string) =>
  new AppError('RULE_VIOLATION', `File ${n} ${words}`, { reason })

const isLink = (n: number) =>
  rule(n, 'file_is_link', "is reached through a link. Give the file's own full path.")
const notAFile = (n: number) => rule(n, 'not_a_file', 'is not a file.')
const notSupported = (n: number) =>
  rule(n, 'not_supported', 'is not a picture, video or font Adman can use.')

// "File {n} could not be read.", with the system's code kept for logUnreadable's warn line.
const unreadable = (n: number, code: string | undefined) =>
  new UnreadableFileError(`File ${n}`, code)

// ELOOP: the open without following found a link at the last part of the path.
function diskError(e: unknown, n: number): AppError {
  if (e instanceof SwappedFileError) return isLink(n)
  const code = (e as NodeJS.ErrnoException | null)?.code
  if (code === 'ENOENT' || code === 'ENOTDIR') return notFound(n)
  if (code === 'ELOOP') return isLink(n)
  return unreadable(n, code)
}

// The after-allow checks of the file at place n, in the order D5 gives them.
export async function checkFile(
  shown: string,
  n: number,
  platform = process.platform,
): Promise<CheckedFile & { type: FileType }> {
  const stillShown = async () => samePath(await fs.promises.realpath(shown), shown, platform)
  let file: CheckedFile
  try {
    if (!(await stillShown())) throw isLink(n)
    const stat = await fs.promises.lstat(shown)
    if (!stat.isFile()) throw notAFile(n)
    file = await readCheckedFile(shown, stat, stillShown)
  } catch (e) {
    throw e instanceof AppError ? e : diskError(e, n)
  }
  const { type } = file
  if (!type || !MEDIA_KINDS.includes(type.kind)) throw notSupported(n)
  return { ...file, type }
}

const changed = () =>
  new AppError('RULE_VIOLATION', 'A file changed while it was read. Try again.', {
    reason: 'file_not_readable',
  })

// The copy step. A file swapped between the checks and the copy (a folder or other bytes in
// its place) is caught by its content hash, read by prepareImport and again from each finished
// copy, and every copy made is removed.
async function copyAll(project: ProjectHandle, paths: string[], hashes: string[]) {
  let prepared: PreparedImport
  try {
    prepared = await prepareImport(project, paths, true)
  } catch (e) {
    if (e instanceof AppError && e.details?.reason === 'assets_folder_missing') throw e
    throw changed()
  }
  if (prepared.hashes.join() !== hashes.join() || prepared.skippedCount > 0) {
    await removeCopies(prepared.copies)
    throw changed()
  }
  if (!(await copiesHoldTheirBytes(prepared))) {
    await removeCopies(prepared.copies)
    throw changed()
  }
  return prepared
}

// R2P-5b: each copy is hashed again once placed, so bytes the handle did not read (the path
// swapped for a link after the checks) never stay in the project.
async function copiesHoldTheirBytes(prepared: PreparedImport): Promise<boolean> {
  try {
    for (const a of prepared.newAssets) {
      if ((await hashOfCopy(a.absPath)) !== a.contentHash) return false
    }
    return true
  } catch {
    return false
  }
}

export async function prepareFileImport(
  project: ProjectHandle,
  paths: readonly string[],
  platform = process.platform,
): Promise<PreparedImport> {
  const shown = importPathTexts(paths, platform)
  const hashes: string[] = []
  for (const [i, p] of shown.entries())
    hashes.push((await checkFile(p, i + 1, platform)).contentHash)
  return copyAll(project, shown, hashes)
}
