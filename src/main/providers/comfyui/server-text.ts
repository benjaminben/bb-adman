// SPEC 6.10.9 [REQ: FR-267, FR-277] (security class): the one function that cleans the
// server's own words before they are stored in job.error_detail. The result is data: it is
// drawn as text only, never parsed, opened or acted on.
import { MAX_SERVER_TEXT_CHARS } from './limits'

// CSI sequences (ESC [ ... final byte), OSC sequences (ESC ] ... BEL or ESC \), then any
// escape character left over with the one character after it.
const CSI = /\u001b\[[0-?]*[ -/]*[@-~]/g
const OSC = /\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g
const LONE_ESCAPE = /\u001b[@-_]?/g
// Control characters other than a line break: C0, DEL and C1.
const CONTROL = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/g

export function cleanServerText(text: string): string {
  const clean = text
    .replace(CSI, '')
    .replace(OSC, '')
    .replace(LONE_ESCAPE, '')
    .replace(CONTROL, ' ')
  if (clean.length <= MAX_SERVER_TEXT_CHARS) return clean
  return `${clean.slice(0, MAX_SERVER_TEXT_CHARS - 1)}…`
}
