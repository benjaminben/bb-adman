// spec/subject-photos.md "How brief.parse checks the paths" [D-098] (security class). A brief
// may come from someone else, so a picture it names is used only when its real place, links
// followed, is inside the brief's folder, and its first bytes are a PNG, JPEG or WebP. A bad
// picture gives a note, never an error. Nothing here logs, and no note holds a folder.
import fs from 'node:fs/promises'
import path from 'node:path'
import { sniffType, SNIFF_BYTES } from './sniff'
import { pathAtOrInside } from './path-resolver'
import { pictureName } from '@/shared/brief/picture-name'
import type { BriefDraft } from '@/shared/schemas/brief'
import type { PictureNoteReason, SubjectPictures } from '@/shared/schemas/commands/brief'

type Subjects = BriefDraft['subjects']
type Checked = { real: string } | { reason: PictureNoteReason }

const DRIVE = /^[A-Za-z]:/

function picturesOf(subject: NonNullable<Subjects>[number]): string[] {
  const { pictures } = subject
  if (pictures === undefined) return []
  return typeof pictures === 'string' ? [pictures] : pictures
}

// Rule 1: the parts of a text that may stay inside the folder, or null when it may not.
// Both `/` and `\` separate folders; empty and `.` parts are skipped; nothing is decoded.
function safeParts(text: string): string[] | null {
  if (text === '' || text.includes('\u0000') || text.startsWith('~')) return null
  if (path.posix.isAbsolute(text) || path.win32.isAbsolute(text) || DRIVE.test(text)) return null
  const parts = text.split(/[/\\]/).filter((part) => part !== '' && part !== '.')
  return parts.includes('..') ? null : parts
}

const missing = (e: unknown) => {
  const code = (e as NodeJS.ErrnoException | null)?.code
  return code === 'ENOENT' || code === 'ENOTDIR'
}
const failure = (e: unknown): Checked => ({ reason: missing(e) ? 'not_found' : 'not_readable' })

// Rule 5: only the first SNIFF_BYTES are read, and nothing of them leaves this function.
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

async function checkOne(realDir: string, text: string): Promise<Checked> {
  const parts = safeParts(text)
  if (parts === null) return { reason: 'outside_folder' }
  let real: string
  try {
    real = await fs.realpath(path.join(realDir, ...parts))
  } catch (e) {
    return failure(e)
  }
  if (!pathAtOrInside(realDir, real)) return { reason: 'outside_folder' }
  try {
    if (!(await fs.stat(real)).isFile()) return { reason: 'not_found' }
    return (await isPicture(real)) ? { real } : { reason: 'not_a_picture' }
  } catch (e) {
    return failure(e)
  }
}

async function checkSubject(realDir: string | null, texts: string[]): Promise<SubjectPictures> {
  const result: SubjectPictures = { paths: [], notes: [] }
  for (const text of texts) {
    const checked: Checked =
      realDir === null ? { reason: 'not_readable' } : await checkOne(realDir, text)
    if ('reason' in checked) result.notes.push({ name: pictureName(text), reason: checked.reason })
    else if (!result.paths.includes(checked.real)) result.paths.push(checked.real)
  }
  return result
}

async function realFolderOf(briefPath: string): Promise<string | null> {
  try {
    return await fs.realpath(path.dirname(briefPath))
  } catch {
    return null
  }
}

// One entry per subject, in order. briefPath is the absolute path of the brief file.
export async function checkBriefPictures(
  briefPath: string,
  subjects: Subjects,
): Promise<SubjectPictures[]> {
  const realDir = await realFolderOf(briefPath)
  const result: SubjectPictures[] = []
  for (const subject of subjects ?? [])
    result.push(await checkSubject(realDir, picturesOf(subject)))
  return result
}

// A typed brief has no folder: every picture it names gets no_folder and no path is checked.
export function picturesWithoutFolder(subjects: Subjects): SubjectPictures[] {
  return (subjects ?? []).map((subject) => ({
    paths: [],
    notes: picturesOf(subject).map((text) => ({ name: pictureName(text), reason: 'no_folder' })),
  }))
}
