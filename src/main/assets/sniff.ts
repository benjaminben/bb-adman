// SPEC 8.3 [REQ: FR-051]: a file is accepted when its extension is in file-types.ts and its
// first bytes match that type. Imported files are untrusted, so the bytes decide, not the name.
import { pictureType } from '@/main/providers/picture-type'
import { fileTypeFor, type FileType } from '@/shared/config/file-types'

// How many first bytes a caller reads before calling sniffType.
export const SNIFF_BYTES = 4096

function asciiAt(head: Uint8Array, at: number, text: string): boolean {
  return [...text].every((c, i) => head[at + i] === c.charCodeAt(0))
}

function startsWith(head: Uint8Array, prefix: number[]): boolean {
  return prefix.every((b, i) => head[i] === b)
}

// QuickTime files made before the ftyp box start with one of these boxes.
const QUICKTIME_BOXES = ['moov', 'mdat', 'wide', 'free', 'skip', 'pnot']

// Text has no signature: it must be UTF-8 with no NUL byte. A character cut off at the end
// of the first bytes is allowed, since only the start of the file is read.
function isText(head: Uint8Array): boolean {
  if (head.includes(0)) return false
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(head, { stream: true })
    return true
  } catch {
    return false
  }
}

// The WebP signature: RIFF, four size bytes, WEBP.
export const hasWebpSignature = (h: Uint8Array) => asciiAt(h, 0, 'RIFF') && asciiAt(h, 8, 'WEBP')

const MATCHES: Record<FileType['id'], (head: Uint8Array) => boolean> = {
  png: (h) => pictureType(h) === 'image/png',
  jpeg: (h) => pictureType(h) === 'image/jpeg',
  webp: hasWebpSignature,
  mp4: (h) => asciiAt(h, 4, 'ftyp'),
  mov: (h) => asciiAt(h, 4, 'ftyp') || QUICKTIME_BOXES.some((box) => asciiAt(h, 4, box)),
  webm: (h) => startsWith(h, [0x1a, 0x45, 0xdf, 0xa3]),
  ttf: (h) => startsWith(h, [0, 1, 0, 0]) || asciiAt(h, 0, 'true'),
  otf: (h) => asciiAt(h, 0, 'OTTO'),
  woff2: (h) => asciiAt(h, 0, 'wOF2'),
  text: isText,
}

// The accepted type of a file from its name and its first bytes, or undefined. An empty
// file matches no type.
export function sniffType(fileName: string, head: Uint8Array): FileType | undefined {
  const type = fileTypeFor(fileName)
  if (!type || head.length === 0) return undefined
  return MATCHES[type.id](head) ? type : undefined
}
