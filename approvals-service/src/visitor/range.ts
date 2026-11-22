// spec/phases/round-2-approvals-video.md "The clip route (service)", step 3: the visitor's Range
// header read to two whole numbers. One range of one form only; everything else is refused.

// The most one clip reply holds. A browser asks again for the rest.
export const CLIP_PIECE = 4 * 1024 * 1024

const MAX_LENGTH = 40
const FORM = /^bytes=(\d{1,15})-(\d{0,15})$/

export type RangeResult =
  { kind: 'piece'; start: number; end: number } | { kind: 'unsatisfiable' } | { kind: 'bad' }

export function parseRange(text: string | null, total: number): RangeResult {
  if (text === null || text.length > MAX_LENGTH) return { kind: 'bad' }
  // `\d` with no `u` flag is ASCII 0 to 9 only; 15 digits stay below 2^53.
  const match = FORM.exec(text)
  if (match === null) return { kind: 'bad' }
  const start = Number(match[1])
  const asked = match[2] === '' ? null : Number(match[2])
  if (start >= total || (asked !== null && asked < start)) return { kind: 'unsatisfiable' }
  const end = Math.min(asked ?? total - 1, total - 1, start + CLIP_PIECE - 1)
  return { kind: 'piece', start, end }
}
