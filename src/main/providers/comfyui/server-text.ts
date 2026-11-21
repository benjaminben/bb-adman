// SPEC 6.10.9 [REQ: FR-267, FR-277] (security class): the one function that cleans the
// server's own words before they are stored in job.error_detail. The result is data: it is
// drawn as text only, never parsed, opened or acted on.
import { MAX_SERVER_TEXT_CHARS } from './limits'

const ESC = 0x1b
const BEL = 0x07
const LINE_BREAK = 0x0a

const codeAt = (text: string, i: number) => text.charCodeAt(i)
const within = (c: number, low: number, high: number) => c >= low && c <= high

// C0 controls, DEL and C1 controls.
const isControl = (c: number) => within(c, 0x00, 0x1f) || within(c, 0x7f, 0x9f)

// Where an escape sequence that starts at `i` ends (its last index): CSI (ESC [ ... final
// byte), OSC (ESC ] ... BEL or ESC \), a two-character escape, or the lone ESC.
function escapeEnd(text: string, i: number): number {
  const next = text[i + 1]
  let j = i + 2
  if (next === '[') {
    while (j < text.length && within(codeAt(text, j), 0x20, 0x3f)) j++
    return j
  }
  if (next === ']') {
    while (j < text.length && codeAt(text, j) !== BEL && codeAt(text, j) !== ESC) j++
    return codeAt(text, j) === ESC && text[j + 1] === '\\' ? j + 1 : j
  }
  return next !== undefined && within(codeAt(text, i + 1), 0x40, 0x5f) ? i + 1 : i
}

// Escape sequences are removed; other control characters but a line break become spaces.
function withoutControls(text: string): string {
  let out = ''
  for (let i = 0; i < text.length; i++) {
    const c = codeAt(text, i)
    if (c === ESC) i = escapeEnd(text, i)
    else out += isControl(c) && c !== LINE_BREAK ? ' ' : text[i]
  }
  return out
}

export function cleanServerText(text: string): string {
  const clean = withoutControls(text)
  if (clean.length <= MAX_SERVER_TEXT_CHARS) return clean
  return `${clean.slice(0, MAX_SERVER_TEXT_CHARS - 1)}…`
}
