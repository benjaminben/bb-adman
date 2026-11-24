// Round 2 plan D3 and spec/brief-brand.md "brief.parse" (security class): one file text a
// brief names, a subject's picture or a brand file. It is an asset ID, an absolute path, or a
// path relative to the brief file. The first rule that fails gives the reason. Nothing here
// logs or throws for a bad file, and nothing of a file's bytes leaves this file.
import fs from 'node:fs/promises'
import path from 'node:path'
import { sniffType, SNIFF_BYTES } from './sniff'
import { pictureRef } from '@/shared/brief/picture-refs'
import type { BrandNoteReason, PictureNoteReason } from '@/shared/schemas/commands/brief'

// The kind of file a text must name: a picture or a font.
export type WantedKind = 'image' | 'font'
export type FileChecked<R> = { real: string } | { assetId: string } | { reason: R }
// The brief file's real folder; a reason when it has none; null for pasted text.
export type BriefFolder = { realDir: string } | { reason: 'not_readable' } | null
// Gives the folder when a relative text needs it, so a text that needs none opens nothing.
export type FolderOf = () => Promise<BriefFolder>

export type FileCheckOptions = {
  // True when the asset of this ID may stand for the text. Without it, every ID is unknown.
  isWanted?: (assetId: string) => boolean
  // Given so a test can judge paths by another system's rules.
  platform?: NodeJS.Platform
}

const missing = (e: unknown) => {
  const code = (e as NodeJS.ErrnoException | null)?.code
  return code === 'ENOENT' || code === 'ENOTDIR'
}
const failure = (e: unknown) => ({
  reason: missing(e) ? ('not_found' as const) : ('not_readable' as const),
})

// Only the first SNIFF_BYTES are read, and nothing of them leaves this function.
async function isKind(file: string, kind: WantedKind): Promise<boolean> {
  const handle = await fs.open(file, 'r')
  try {
    const head = new Uint8Array(SNIFF_BYTES)
    const { bytesRead } = await handle.read(head, 0, SNIFF_BYTES, 0)
    return sniffType(path.basename(file), head.subarray(0, bytesRead))?.kind === kind
  } finally {
    await handle.close()
  }
}

const WRONG = { image: 'not_a_picture', font: 'not_a_font' } as const

// D3 rule 4: a regular file whose ending and first bytes are of the wanted kind, by its real
// path.
async function checkFile(file: string, kind: WantedKind): Promise<FileChecked<BrandNoteReason>> {
  if (file.includes('\u0000')) return { reason: 'not_found' }
  let real: string
  try {
    real = await fs.realpath(file)
  } catch (e) {
    return failure(e)
  }
  try {
    if (!(await fs.stat(real)).isFile()) return { reason: 'not_found' }
    return (await isKind(real, kind)) ? { real } : { reason: WRONG[kind] }
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

export async function briefFolderOf(briefPath: string | null): Promise<BriefFolder> {
  if (briefPath === null) return null
  try {
    return { realDir: await fs.realpath(path.dirname(briefPath)) }
  } catch {
    return { reason: 'not_readable' }
  }
}

// The folder of briefPath, looked up once, on first use.
export function lazyFolderOf(briefPath: string | null): FolderOf {
  let folder: Promise<BriefFolder> | undefined
  return () => (folder ??= briefFolderOf(briefPath))
}

// A picture text never gives not_a_font; a font text never gives not_a_picture.
export function checkBriefFile(
  folderOf: FolderOf,
  text: string,
  kind: 'image',
  options: FileCheckOptions,
): Promise<FileChecked<PictureNoteReason>>
export function checkBriefFile(
  folderOf: FolderOf,
  text: string,
  kind: WantedKind,
  options: FileCheckOptions,
): Promise<FileChecked<BrandNoteReason>>
export async function checkBriefFile(
  folderOf: FolderOf,
  text: string,
  kind: WantedKind,
  options: FileCheckOptions,
): Promise<FileChecked<BrandNoteReason>> {
  const platform = options.platform ?? process.platform
  const ref = pictureRef(text, platform)
  if (ref.kind === 'asset') {
    return options.isWanted?.(ref.assetId) === true
      ? { assetId: ref.assetId }
      : { reason: 'unknown_asset' }
  }
  if (ref.kind === 'file') {
    if (isNetworkPath(text, ref.path, platform)) return { reason: 'not_readable' }
    return checkFile(ref.path, kind)
  }
  const folder = await folderOf()
  if (folder === null) return { reason: 'not_full_path' }
  if ('reason' in folder) return folder
  if (text.includes('\u0000')) return { reason: 'not_found' }
  return checkFile(joined(folder.realDir, text), kind)
}
