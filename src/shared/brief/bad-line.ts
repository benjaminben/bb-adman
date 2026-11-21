// SPEC 14 1.39 "The YAML message" (security class; Z3, FR-297): the first line of a malformed
// YAML brief, numbered and cleaned so it shows nothing that can hide or reorder text. The text
// goes into the command's error and nowhere else. Pure; never throws.
import type { ErrorBody } from '@/shared/schemas/result'
import { MAX_BAD_LINE_CHARS } from '@/shared/config/brief-limits'

// Control characters, the invisible marks that can reorder or hide text on screen, the
// byte-order mark, and lone surrogates (a string's for...of gives one alone as one item).
const REMOVED: [number, number][] = [
  [0x0000, 0x001f],
  [0x007f, 0x009f],
  // Marks and fillers that draw nothing (SP-1 review Note 4).
  [0x00ad, 0x00ad],
  [0x034f, 0x034f],
  [0x061c, 0x061c],
  [0x115f, 0x1160],
  [0x180e, 0x180e],
  [0x3164, 0x3164],
  [0xfe00, 0xfe0f],
  [0xffa0, 0xffa0],
  [0xe0000, 0xe007f],
  [0x200b, 0x200f],
  [0x2028, 0x202e],
  [0x2060, 0x2069],
  [0xfeff, 0xfeff],
  [0xd800, 0xdfff],
]

function removed(char: string): boolean {
  const point = char.codePointAt(0) ?? 0
  return REMOVED.some(([low, high]) => point >= low && point <= high)
}

// Tabs to spaces, hidden and reordering characters removed, end trimmed, cut to
// MAX_BAD_LINE_CHARS code points with "…". Also used for the names photo notes show.
export function cleanLineText(raw: string): string {
  const kept: string[] = []
  for (const char of raw.replace(/\t/g, ' ')) {
    if (!removed(char)) kept.push(char)
  }
  const points = Array.from(kept.join('').trimEnd())
  const cut = points.length > MAX_BAD_LINE_CHARS
  return points.slice(0, MAX_BAD_LINE_CHARS).join('') + (cut ? '…' : '')
}

// An offset past the end counts as the last line. `body` is the text after one byte-order
// mark is removed.
export function badLineAt(body: string, offset: number): { line: number; text: string } {
  const at = Math.max(0, Math.min(offset, body.length))
  const before = body.slice(0, at)
  const start = before.lastIndexOf('\n') + 1
  const end = body.indexOf('\n', at)
  const line = before.split('\n').length
  return {
    line,
    text: cleanLineText(body.slice(start, end === -1 ? body.length : end).replace(/\r$/, '')),
  }
}

export function badLineError(body: string, offset: number): ErrorBody {
  const { line, text } = badLineAt(body, offset)
  const lead = `The brief is malformed. The first line that could not be read is line ${line}`
  return {
    code: 'INVALID_INPUT',
    message: text === '' ? `${lead}.` : `${lead}: ${text}`,
    details: { reason: 'brief_unreadable', line, lineText: text },
  }
}
