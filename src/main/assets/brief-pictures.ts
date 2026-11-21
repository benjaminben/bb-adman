// spec/subject-photos.md "How brief.parse checks the paths" [D-098] (security class). A brief
// may come from someone else, so a picture it names is used only when its real place, links
// followed, is inside the brief's folder, and its first bytes are a PNG, JPEG or WebP. A bad
// picture gives a note, never an error. Nothing here logs, and no note holds a folder.
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { sniffType, SNIFF_BYTES } from './sniff'
import { pathAtOrInside } from './path-resolver'
import { pictureName } from '@/shared/brief/picture-name'
import type { BriefDraft } from '@/shared/schemas/brief'
import type { PictureNoteReason, SubjectPictures } from '@/shared/schemas/commands/brief'

type Subjects = BriefDraft['subjects']
type Checked = { real: string } | { reason: PictureNoteReason }
type Folder = { realDir: string } | { reason: PictureNoteReason }

// Where the app runs, given so a test need not use the real home folder.
export type BriefPlace = { home: string; platform: NodeJS.Platform }
const hostPlace = (): BriefPlace => ({ home: os.homedir(), platform: process.platform })

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

async function checkSubject(folder: Folder, texts: string[]): Promise<SubjectPictures> {
  const result: SubjectPictures = { paths: [], notes: [] }
  for (const text of texts) {
    const checked: Checked = 'reason' in folder ? folder : await checkOne(folder.realDir, text)
    if ('reason' in checked) result.notes.push({ name: pictureName(text), reason: checked.reason })
    else if (!result.paths.includes(checked.real)) result.paths.push(checked.real)
  }
  return result
}

// spec/subject-photos.md "A folder that is too wide" (A-123): a brief in the filesystem root,
// a drive or share root, a Mac volume's top, or the home folder itself could name almost any
// picture on the disk, so none is taken. Both folders are real paths. Pure, and judged with the
// given platform's path rules, so every case runs on any machine.
export function isWideFolder(
  realDir: string,
  realHome: string,
  platform: NodeJS.Platform,
): boolean {
  const rules = platform === 'win32' ? path.win32 : path.posix
  const folded = platform === 'win32' || platform === 'darwin'
  const same = (p: string) => (folded ? p.toLowerCase() : p)
  const dir = same(rules.resolve(realDir))
  if (same(rules.parse(dir).root) === dir || dir === same(rules.resolve(realHome))) return true
  if (platform !== 'darwin') return false
  return dir === '/volumes' || rules.dirname(dir) === '/volumes'
}

async function realOr(dir: string): Promise<string | null> {
  try {
    return await fs.realpath(dir)
  } catch {
    return null
  }
}

async function folderOf(briefPath: string, place: BriefPlace): Promise<Folder> {
  const realDir = await realOr(path.dirname(briefPath))
  if (realDir === null) return { reason: 'not_readable' }
  const home = (await realOr(place.home)) ?? place.home
  return isWideFolder(realDir, home, place.platform) ? { reason: 'wide_folder' } : { realDir }
}

// One entry per subject, in order. briefPath is the absolute path of the brief file.
export async function checkBriefPictures(
  briefPath: string,
  subjects: Subjects,
  place: BriefPlace = hostPlace(),
): Promise<SubjectPictures[]> {
  const folder = await folderOf(briefPath, place)
  const result: SubjectPictures[] = []
  for (const subject of subjects ?? []) result.push(await checkSubject(folder, picturesOf(subject)))
  return result
}

// A typed brief has no folder: every picture it names gets no_folder and no path is checked.
export function picturesWithoutFolder(subjects: Subjects): SubjectPictures[] {
  return (subjects ?? []).map((subject) => ({
    paths: [],
    notes: picturesOf(subject).map((text) => ({ name: pictureName(text), reason: 'no_folder' })),
  }))
}
