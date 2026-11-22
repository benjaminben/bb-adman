// Round 2 plan D3 [A-343 to A-346] (security class): the pictures a brief a person loads or
// pastes names. The stakeholder lifted the rule that a brief may only name pictures in its
// own folder, so a path may name any file on the disk; the normal import checks still apply.
// An asset ID must be an image of the open project. A bad picture gives a note, never an
// error. Nothing here logs, and no note holds a folder: a note's name is pictureName's.
import fs from 'node:fs/promises'
import path from 'node:path'
import { sniffType, SNIFF_BYTES } from './sniff'
import { pictureName } from '@/shared/brief/picture-name'
import { pictureRef } from '@/shared/brief/picture-refs'
import type { BriefDraft } from '@/shared/schemas/brief'
import type { PictureNoteReason, SubjectPictures } from '@/shared/schemas/commands/brief'

type Subjects = BriefDraft['subjects']
type Checked = { real: string } | { assetId: string } | { reason: PictureNoteReason }
// The brief file's real folder; a reason when it has none; null for pasted text.
type Folder = { realDir: string } | { reason: PictureNoteReason } | null

export type BriefPictureOptions = {
  // True when the open project holds an asset of this ID with kind image. Without it, every
  // asset ID is unknown_asset.
  isImage?: (assetId: string) => boolean
  // Given so a test can judge paths by another system's rules.
  platform?: NodeJS.Platform
}

function picturesOf(subject: NonNullable<Subjects>[number]): string[] {
  const { pictures } = subject
  if (pictures === undefined) return []
  return typeof pictures === 'string' ? [pictures] : pictures
}

const missing = (e: unknown) => {
  const code = (e as NodeJS.ErrnoException | null)?.code
  return code === 'ENOENT' || code === 'ENOTDIR'
}
const failure = (e: unknown): Checked => ({ reason: missing(e) ? 'not_found' : 'not_readable' })

// Only the first SNIFF_BYTES are read, and nothing of them leaves this function.
async function isPicture(file: string): Promise<boolean> {
  const handle = await fs.open(file, 'r')
  try {
    const head = new Uint8Array(SNIFF_BYTES)
    const { bytesRead } = await handle.read(head, 0, SNIFF_BYTES, 0)
    return sniffType(path.basename(file), head.subarray(0, bytesRead))?.kind === 'image'
  } finally {
    await handle.close()
  }
}

// D3 rule 3: a regular file whose ending and first bytes say picture, by its real path.
async function checkFile(file: string): Promise<Checked> {
  if (file.includes('\u0000')) return { reason: 'not_found' }
  let real: string
  try {
    real = await fs.realpath(file)
  } catch (e) {
    return failure(e)
  }
  try {
    if (!(await fs.stat(real)).isFile()) return { reason: 'not_found' }
    return (await isPicture(real)) ? { real } : { reason: 'not_a_picture' }
  } catch (e) {
    return failure(e)
  }
}

// D3 rule 2: a relative text is joined onto the brief file's folder (it may lead out of it).
// Both `/` and `\` separate its parts, as a brief written on either system would use them.
function joined(realDir: string, text: string): string {
  return path.join(realDir, ...text.split(/[/\\]/))
}

// On Windows a path that starts with two separators is a network or device path. Opening one
// sends the user's Windows sign-in to the server it names, so a brief never opens it.
function isNetworkPath(text: string, file: string, platform: NodeJS.Platform): boolean {
  return platform === 'win32' && (/^[\\/]{2}/.test(text) || /^[\\/]{2}/.test(file))
}

async function checkOne(folder: Folder, text: string, options: BriefPictureOptions) {
  const platform = options.platform ?? process.platform
  const ref = pictureRef(text, platform)
  if (ref.kind === 'asset') {
    return options.isImage?.(ref.assetId) === true
      ? { assetId: ref.assetId }
      : { reason: 'unknown_asset' as const }
  }
  if (ref.kind === 'file') {
    if (isNetworkPath(text, ref.path, platform)) return { reason: 'not_readable' as const }
    return checkFile(ref.path)
  }
  if (folder === null) return { reason: 'not_full_path' as const }
  if ('reason' in folder) return folder
  if (text.includes('\u0000')) return { reason: 'not_found' as const }
  return checkFile(joined(folder.realDir, text))
}

async function checkSubject(
  folder: Folder,
  texts: string[],
  options: BriefPictureOptions,
): Promise<SubjectPictures> {
  const result: SubjectPictures = { paths: [], assetIds: [], notes: [] }
  for (const text of texts) {
    const checked: Checked = await checkOne(folder, text, options)
    if ('reason' in checked) result.notes.push({ name: pictureName(text), reason: checked.reason })
    else if ('assetId' in checked) {
      if (!result.assetIds.includes(checked.assetId)) result.assetIds.push(checked.assetId)
    } else if (!result.paths.includes(checked.real)) result.paths.push(checked.real)
  }
  return result
}

async function folderOf(briefPath: string | null): Promise<Folder> {
  if (briefPath === null) return null
  try {
    return { realDir: await fs.realpath(path.dirname(briefPath)) }
  } catch {
    return { reason: 'not_readable' }
  }
}

// One entry per subject, in order. briefPath is the absolute path of the brief file, or null
// for pasted text, which has no folder.
export async function checkBriefPictures(
  briefPath: string | null,
  subjects: Subjects,
  options: BriefPictureOptions = {},
): Promise<SubjectPictures[]> {
  const folder = await folderOf(briefPath)
  const result: SubjectPictures[] = []
  for (const subject of subjects ?? []) {
    result.push(await checkSubject(folder, picturesOf(subject), options))
  }
  return result
}
