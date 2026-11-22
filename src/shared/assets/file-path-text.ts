// Round 2 plan D5 [A-348]: the text rules for a file an agent names by its full path, run
// before the user is asked. Pure: nothing on disk is read, so a refusal here says nothing about
// whether a file exists. A refusal names the file by its place in the list (1-based), never by
// its path or name. D6 runs the same rules over the pictures of a brief.
import { fileTypeFor, type AssetKind } from '@/shared/config/file-types'
import { pictureRef } from '@/shared/brief/picture-refs'

export const MAX_FILES = 20
export const MAX_PATH_CHARS = 4096

export const MEDIA_KINDS: readonly AssetKind[] = ['image', 'video', 'font']

export type PathTextReason =
  'too_many_files' | 'not_full_path' | 'hidden_characters' | 'not_supported'

export type PathTextRefusal = { reason: PathTextReason; index: number }

export type PathText = { ok: true; path: string } | { ok: false; refusal: PathTextRefusal }

// Unicode Cc (control) and Cf (format) characters, which can hide or reorder text on screen,
// and (R2P-5b) the line and paragraph separators and every space but the plain one, which can
// break a line or pass for a plain space.
const HIDDEN = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]|(?! )\p{Zs}/u

// R2P-5b, Windows only: two separators first is a network or device path (opening a network
// path sends the user's Windows sign-in to that server), and a colon after the drive names a
// second stream of a file rather than the file.
function notWindowsFile(text: string): boolean {
  if (/^[\\/]{2}/.test(text)) return true
  return text.replace(/^[A-Za-z]:/, '').includes(':')
}

// The last segment of a normalised path, on either separator.
const lastSegment = (path: string): string => path.split(/[\\/]/).pop() ?? ''

// One path at place `index`: its normalised text, or the first rule it breaks.
export function checkPathText(
  text: string,
  index: number,
  platform: NodeJS.Platform,
  kinds: readonly AssetKind[] = MEDIA_KINDS,
): PathText {
  const refuse = (reason: PathTextReason): PathText => ({ ok: false, refusal: { reason, index } })
  const ref = text.length > MAX_PATH_CHARS ? null : pictureRef(text, platform)
  if (ref?.kind !== 'file') return refuse('not_full_path')
  const winOdd = platform === 'win32' && (notWindowsFile(text) || notWindowsFile(ref.path))
  if (winOdd) return refuse('not_full_path')
  if (HIDDEN.test(text)) return refuse('hidden_characters')
  const kind = fileTypeFor(lastSegment(ref.path))?.kind
  if (kind === undefined || !kinds.includes(kind)) return refuse('not_supported')
  return { ok: true, path: ref.path }
}

export type PathTexts = { ok: true; paths: string[] } | { ok: false; refusal: PathTextRefusal }

// The whole list, in order; the first refusal stands for the whole call.
export function checkPathTexts(texts: readonly string[], platform: NodeJS.Platform): PathTexts {
  if (texts.length > MAX_FILES) {
    return { ok: false, refusal: { reason: 'too_many_files', index: MAX_FILES + 1 } }
  }
  const paths: string[] = []
  for (const [i, text] of texts.entries()) {
    const checked = checkPathText(text, i + 1, platform)
    if (!checked.ok) return checked
    paths.push(checked.path)
  }
  return { ok: true, paths }
}

// The D5 sentence for each refusal.
export function pathTextMessage({ reason, index }: PathTextRefusal): string {
  if (reason === 'too_many_files') return `Give at most ${MAX_FILES} files in one call.`
  if (reason === 'not_full_path') return `File ${index} is not a full path.`
  if (reason === 'hidden_characters') return `File ${index}'s path holds hidden characters.`
  return `File ${index} is not a picture, video or font Adman can use.`
}
