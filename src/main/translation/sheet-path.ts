// The checks on the translation sheet's path, and its safe write (spec/phases/phase-06.md,
// design addition 4). The path comes from outside the project, so every check runs before
// anything is written, and no message names the path.
import fs from 'node:fs'
import path from 'node:path'
import type { ProjectHandle } from '@/main/db/project-file'
import { assetsDirOf } from '@/main/assets/service'
import { pathAtOrInside } from '@/main/assets/path-resolver'
import { AppError } from '@/shared/schemas/result'
import { checkSheetPathShape } from './sheet-path-shape'

const notAFile = () =>
  new AppError('RULE_VIOLATION', 'Something that is not a file is already there.')

// The real path, so a link cannot hide where a folder is; the path itself when it is not there.
function realOrSelf(p: string): Promise<string> {
  return fs.promises.realpath(p).catch(() => path.resolve(p))
}

const lstatOrNull = (p: string) => fs.promises.lstat(p).catch(() => null)

// Gives the target to write. An existing regular file there is replaced (the save dialog
// asked); anything else there, a link included, is refused, so the write never goes elsewhere.
// The project file ends in .adman, so a .csv target is never the project file itself.
export async function checkSheetPath(project: ProjectHandle, filePath: string): Promise<string> {
  const target = checkSheetPathShape(filePath)
  const folder = path.dirname(target)
  const stat = await fs.promises.stat(folder).catch(() => null)
  if (!stat?.isDirectory()) throw new AppError('NOT_FOUND', 'That folder was not found.')
  const [assetsDir, realFolder] = await Promise.all([
    realOrSelf(assetsDirOf(project)),
    realOrSelf(folder),
  ])
  if (pathAtOrInside(assetsDir, realFolder)) {
    throw new AppError('RULE_VIOLATION', "Choose a folder outside the project's assets folder.")
  }
  const existing = await lstatOrNull(target)
  if (existing && !existing.isFile()) throw notAFile()
  return target
}

const writeFailed = () =>
  new AppError('INTERNAL', 'The sheet could not be written.', { reason: 'write_failed' })

// Written to {target}.partial with the wx flag (never through a link, never over a file), then
// renamed over the target. The partial file is removed on any failure after it was made; one
// that was already there is left alone. No error text from the file system goes on, since it
// can hold the path.
export async function writeSheet(target: string, text: string): Promise<void> {
  const partial = `${target}.partial`
  try {
    await fs.promises.writeFile(partial, text, { encoding: 'utf8', flag: 'wx' })
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new AppError('RULE_VIOLATION', 'An unfinished sheet file is in the way.', {
        reason: 'partial_in_the_way',
      })
    }
    await removeQuietly(partial)
    throw writeFailed()
  }
  try {
    await fs.promises.rename(partial, target)
  } catch {
    await removeQuietly(partial)
    throw writeFailed()
  }
}

const removeQuietly = (p: string) => fs.promises.rm(p, { force: true }).catch(() => undefined)
