// A path as the dialog draws it (spec/phases/round-2-platform.md, D7). Characters that draw
// nothing or move other characters (control codes, line breaks, direction marks, zero-width
// marks) are shown as [U+XXXX], so a path cannot hide part of itself, pass for two paths or
// read backwards. Every other character is kept as it is.
const HIDDEN_RANGES: Array<[number, number]> = [
  [0x0000, 0x001f],
  [0x007f, 0x009f],
  [0x061c, 0x061c],
  [0x200b, 0x200f],
  [0x2028, 0x202e],
  [0x2060, 0x2069],
  [0xfeff, 0xfeff],
]

function hidden(point: number): boolean {
  return HIDDEN_RANGES.some(([low, high]) => point >= low && point <= high)
}

export function visiblePath(path: string): string {
  let shown = ''
  for (const char of path) {
    const point = char.codePointAt(0) ?? 0
    shown += hidden(point) ? `[U+${point.toString(16).toUpperCase().padStart(4, '0')}]` : char
  }
  return shown
}
