// P7-6: the one byte range of an adman-asset:// request, read strictly. Pure, no Electron.
// Only `bytes=a-b`, `bytes=a-` and `bytes=-n` are read, digits only, at most 16 each. Several
// ranges, or anything else, gives 'whole': the header is ignored and the whole file is sent.

export type ByteRange = { start: number; end: number }

// Anchored at both ends and with no flags, so no space, sign, comma or line break gets in.
const SINGLE = /^bytes=(\d{0,16})-(\d{0,16})$/

// `end` is inclusive. Sixteen digits can pass the largest exact number, but every such value
// is past any file, so it is refused as a start and cut to the file as an end or suffix.
export function parseRange(
  header: string | null | undefined,
  size: number,
): ByteRange | 'whole' | 'unsatisfiable' {
  const match = SINGLE.exec(header ?? '')
  if (!match) return 'whole'
  const first = match[1] ?? ''
  const last = match[2] ?? ''
  if (first === '' && last === '') return 'whole'
  if (first === '') {
    const suffix = Number(last)
    if (suffix === 0 || size === 0) return 'unsatisfiable'
    return { start: Math.max(0, size - suffix), end: size - 1 }
  }
  const start = Number(first)
  const end = last === '' ? Infinity : Number(last)
  if (end < start) return 'whole'
  if (start >= size) return 'unsatisfiable'
  return { start, end: Math.min(end, size - 1) }
}
