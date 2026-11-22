// The MP4 box walk and the header fields read from it (SPEC 6.10.7), shared by checkMp4 and
// videoFileFacts. It reads box headers and a few fields only, and never decodes. Each refusal
// is a plain Error with a fixed message, so nothing from the file reaches a message.
export const MP4_REFUSED = {
  tooLarge: 'The video file is over the size limit.',
  notMp4: 'The file is not an MP4 video.',
  badBox: 'The MP4 file has a box the app cannot read.',
  tooManyBoxes: 'The MP4 file has too many boxes.',
  tooDeep: 'The MP4 file has boxes nested too deep.',
  noVideo: 'The MP4 file has no video track.',
  tooBig: 'The video is wider or taller than the app accepts.',
  tooLong: 'The video is longer than the app accepts.',
  noFrames: 'The MP4 file has no video frames.',
} as const

export const MAX_BOXES = 10_000
const MAX_DEPTH = 8
// The boxes whose contents are boxes, and so are walked into.
const CONTAINERS = new Set([
  'moov',
  'trak',
  'mdia',
  'minf',
  'stbl',
  'dinf',
  'edts',
  'udta',
  'moof',
  'traf',
])

export type Box = { type: string; start: number; end: number; children: Box[] }

export const refuse = (message: string): never => {
  throw new Error(message)
}

export function typeAt(view: DataView, at: number): string {
  let type = ''
  for (let i = 0; i < 4; i++) type += String.fromCharCode(view.getUint8(at + i))
  return type
}

// The boxes between from and to, and their children, with every size checked.
export function walk(
  view: DataView,
  from: number,
  to: number,
  depth: number,
  count: { n: number },
) {
  if (depth > MAX_DEPTH) refuse(MP4_REFUSED.tooDeep)
  const boxes: Box[] = []
  let at = from
  while (at < to) {
    if (to - at < 8) refuse(MP4_REFUSED.badBox)
    count.n += 1
    if (count.n > MAX_BOXES) refuse(MP4_REFUSED.tooManyBoxes)
    let size = view.getUint32(at)
    let headerSize = 8
    if (size === 1) {
      if (to - at < 16) refuse(MP4_REFUSED.badBox)
      const large = view.getBigUint64(at + 8)
      size = large > BigInt(to - at) ? to - at + 1 : Number(large)
      headerSize = 16
    }
    if (size === 0 || size < headerSize || size > to - at) refuse(MP4_REFUSED.badBox)
    const type = typeAt(view, at + 4)
    const end = at + size
    const children = CONTAINERS.has(type) ? walk(view, at + headerSize, end, depth + 1, count) : []
    boxes.push({ type, start: at + headerSize, end, children })
    at = end
  }
  return boxes
}

export const child = (parent: Box, type: string) => parent.children.find((b) => b.type === type)

// A field of `length` bytes at `offset` in the box's payload; a box too short is refused.
export function field(view: DataView, b: Box, offset: number, length: 4 | 8): number {
  if (b.start + offset + length > b.end) refuse(MP4_REFUSED.badBox)
  const at = b.start + offset
  return length === 4 ? view.getUint32(at) : Number(view.getBigUint64(at))
}

export function handlerOf(view: DataView, track: Box): string | null {
  const media = child(track, 'mdia')
  const handler = media && child(media, 'hdlr')
  if (!handler) return null
  field(view, handler, 8, 4)
  return typeAt(view, handler.start + 8)
}

// The track header's width and height, 16.16 numbers, after version 0 or 1 fields.
export function sizeOf(view: DataView, track: Box): { width: number; height: number } {
  const header = child(track, 'tkhd') ?? refuse(MP4_REFUSED.badBox)
  const at = view.getUint8(header.start) === 1 ? 88 : 76
  const width = Math.round(field(view, header, at, 4) / 65536)
  const height = Math.round(field(view, header, at + 4, 4) / 65536)
  return { width, height }
}

export function durationOf(view: DataView, moov: Box): number {
  const header = child(moov, 'mvhd') ?? refuse(MP4_REFUSED.noVideo)
  const v1 = view.getUint8(header.start) === 1
  const timescale = field(view, header, v1 ? 20 : 12, 4)
  const duration = field(view, header, v1 ? 24 : 16, v1 ? 8 : 4)
  if (timescale === 0) refuse(MP4_REFUSED.tooLong)
  return Math.round((duration * 1000) / timescale)
}

// MP4-1: the sample count of a video track's stsz (at 8), or for a fragmented file of a trun
// (at 4) whose traf's tfhd names a video track's ID (tkhd at 12, or 20 for version 1).
function trackId(view: DataView, track: Box): number {
  const header = child(track, 'tkhd') ?? refuse(MP4_REFUSED.badBox)
  return field(view, header, view.getUint8(header.start) === 1 ? 20 : 12, 4)
}

function stszCount(view: DataView, track: Box): number {
  const media = child(track, 'mdia')
  const info = media && child(media, 'minf')
  const table = info && child(info, 'stbl')
  const sizes = table && child(table, 'stsz')
  return sizes ? field(view, sizes, 8, 4) : 0
}

export function hasFrames(view: DataView, top: Box[], videos: Box[]): boolean {
  if (videos.some((t) => stszCount(view, t) > 0)) return true
  const ids = new Set(videos.map((t) => trackId(view, t)))
  const fragments = top.filter((b) => b.type === 'moof').flatMap((m) => m.children)
  return fragments.some((traf) => {
    const header = child(traf, 'tfhd')
    if (traf.type !== 'traf' || !header || !ids.has(field(view, header, 4, 4))) return false
    return traf.children.some((b) => b.type === 'trun' && field(view, b, 4, 4) > 0)
  })
}
