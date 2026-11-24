// The files a brief names: each subject's photos, the logo and the two fonts. Each is read from
// beside the brief or from a full path, as the app's brief form reads them, and kept only when
// its ending and first bytes say it is of the wanted kind. A file that cannot be used is left
// out with one plain note; the run goes on.
import { readFile } from 'node:fs/promises'
import { basename, isAbsolute, join } from 'node:path'
import { readFontFamily } from '@/main/assets/font-name'
import { SNIFF_BYTES, sniffType } from '@/main/assets/sniff'
import { pictureSize } from '@/main/providers/picture-size'
import type { ImageFile } from '@/main/providers/types'
import { pictureName } from '@/shared/brief/picture-name'
import type { AssetKind, FileType } from '@/shared/config/file-types'
import type { BrandRole } from '@/shared/schemas/commands/brief'
import { fileNoteLine, type FileReason, type FileWhat } from './notes'
import type { Plan } from './plan'

type WantedKind = Extract<AssetKind, 'image' | 'font'>

export type BriefFile =
  { ok: true; bytes: Uint8Array; mime: string } | { ok: false; reason: FileReason }

export type LogoFile = ImageFile & { width: number | null; height: number | null }
export type FontFile = ImageFile & { family: string | null }

export type Brand = {
  logo: LogoFile | null
  heading: FontFile | null
  body: FontFile | null
  notes: string[]
}

// The accepted type of a file of the wanted kind, from its ending and its first bytes. Pure.
export function fileTypeOf(
  name: string,
  bytes: Uint8Array,
  kind: WantedKind,
): FileType | undefined {
  const type = sniffType(name, bytes.subarray(0, SNIFF_BYTES))
  return type?.kind === kind ? type : undefined
}

const isMissing = (error: unknown) => {
  const code = (error as NodeJS.ErrnoException | null)?.code
  return code === 'ENOENT' || code === 'ENOTDIR' || code === 'EISDIR'
}

// On Windows a path that starts with two separators is a network or device path. Opening one
// sends the user's Windows sign-in to the server it names, so a brief never opens it.
const isNetworkPath = (text: string, platform: NodeJS.Platform) =>
  platform === 'win32' && /^[\\/]{2}/.test(text)

// One file a brief names: a full path as it is, any other text joined onto the brief's folder
// (both `/` and `\` separate its parts, as a brief written on either system would use them).
export async function readBriefFile(
  briefFolder: string,
  text: string,
  kind: WantedKind,
  platform: NodeJS.Platform = process.platform,
): Promise<BriefFile> {
  if (isNetworkPath(text, platform)) return { ok: false, reason: 'not_readable' }
  if (text.includes('\u0000')) return { ok: false, reason: 'not_found' }
  const path = isAbsolute(text) ? text : join(briefFolder, ...text.split(/[/\\]/))
  let bytes: Uint8Array
  try {
    bytes = new Uint8Array(await readFile(path))
  } catch (error) {
    return { ok: false, reason: isMissing(error) ? 'not_found' : 'not_readable' }
  }
  const type = fileTypeOf(basename(path), bytes, kind)
  if (!type) return { ok: false, reason: kind === 'font' ? 'not_a_font' : 'not_a_picture' }
  return { ok: true, bytes, mime: type.mime }
}

// A photo as read, named by the last part of its path.
export type SubjectPhoto = { name: string; file: ImageFile }

export type SubjectPhotos = {
  // Every photo, in brief order.
  files: ImageFile[]
  // The photos of each subject, in the order of plan.subjects.
  bySubject: SubjectPhoto[][]
  notes: string[]
}

// Each subject's photos, in brief order; a photo that cannot be used gets a note.
export async function readSubjectPhotos(plan: Plan, briefFolder: string): Promise<SubjectPhotos> {
  const bySubject: SubjectPhoto[][] = []
  const notes: string[] = []
  for (const subject of plan.subjects) {
    const photos: SubjectPhoto[] = []
    for (const text of subject.pictures) {
      const file = await readBriefFile(briefFolder, text, 'image')
      if (file.ok)
        photos.push({ name: pictureName(text), file: { bytes: file.bytes, mime: file.mime } })
      else notes.push(fileNoteLine('photo', text, file.reason))
    }
    bySubject.push(photos)
  }
  return { files: bySubject.flat().map((photo) => photo.file), bySubject, notes }
}

// A PNG or JPEG gives its size; a WebP gives none, as for an app asset.
function sizeOf(file: ImageFile): { width: number | null; height: number | null } {
  const { mime } = file
  try {
    if (mime === 'image/png' || mime === 'image/jpeg') return pictureSize(file.bytes, mime)
    return { width: null, height: null }
  } catch {
    return { width: null, height: null }
  }
}

const WHAT: Record<BrandRole, FileWhat> = {
  logo: 'logo',
  headingFont: 'headline font',
  bodyFont: 'text font',
}

// The logo and the two fonts, each left out with a note when it cannot be used.
export async function readBrand(plan: Plan, briefFolder: string): Promise<Brand> {
  const brand: Brand = { logo: null, heading: null, body: null, notes: [] }
  for (const { role, text } of plan.brandFiles) {
    const file = await readBriefFile(briefFolder, text, role === 'logo' ? 'image' : 'font')
    if (!file.ok) {
      brand.notes.push(fileNoteLine(WHAT[role], text, file.reason))
      continue
    }
    const kept = { bytes: file.bytes, mime: file.mime }
    if (role === 'logo') brand.logo = { ...kept, ...sizeOf(kept) }
    else {
      const font = { ...kept, family: readFontFamily(file.bytes) }
      if (role === 'headingFont') brand.heading = font
      else brand.body = font
    }
  }
  return brand
}
