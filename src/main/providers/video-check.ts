// SPEC 6.10.7 "What applies to a video file" [REQ: FR-262, FR-283] (security class), with the
// 1.39 sound rule: the one check of a video file from any provider, before it is stored. It
// reads box headers and a few header fields only, and never decodes. Each refusal is a plain
// Error with a fixed message, so nothing from the file reaches a message.
import { MAX_VIDEO_BYTES, MAX_VIDEO_MS, MAX_VIDEO_SIDE } from './picture-limits'

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

export type Mp4Details = { width: number; height: number; durationMs: number; hasSound: boolean }

const MAX_BOXES = 10_000
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

type Box = { type: string; start: number; end: number; children: Box[] }

const refuse = (message: string): never => {
  throw new Error(message)
}

function typeAt(view: DataView, at: number): string {
  let type = ''
  for (let i = 0; i < 4; i++) type += String.fromCharCode(view.getUint8(at + i))
  return type
}

// The boxes between from and to, and their children, with every size checked.
function walk(view: DataView, from: number, to: number, depth: number, count: { n: number }) {
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

const child = (parent: Box, type: string) => parent.children.find((b) => b.type === type)

// A field of `length` bytes at `offset` in the box's payload; a box too short is refused.
function field(view: DataView, b: Box, offset: number, length: 4 | 8): number {
  if (b.start + offset + length > b.end) refuse(MP4_REFUSED.badBox)
  const at = b.start + offset
  return length === 4 ? view.getUint32(at) : Number(view.getBigUint64(at))
}

function handlerOf(view: DataView, track: Box): string | null {
  const media = child(track, 'mdia')
  const handler = media && child(media, 'hdlr')
  if (!handler) return null
  field(view, handler, 8, 4)
  return typeAt(view, handler.start + 8)
}

// The track header's width and height, 16.16 numbers, after version 0 or 1 fields.
function sizeOf(view: DataView, track: Box): { width: number; height: number } {
  const header = child(track, 'tkhd') ?? refuse(MP4_REFUSED.badBox)
  const at = view.getUint8(header.start) === 1 ? 88 : 76
  const width = Math.round(field(view, header, at, 4) / 65536)
  const height = Math.round(field(view, header, at + 4, 4) / 65536)
  return { width, height }
}

function durationOf(view: DataView, moov: Box): number {
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

function hasFrames(view: DataView, top: Box[], videos: Box[]): boolean {
  if (videos.some((t) => stszCount(view, t) > 0)) return true
  const ids = new Set(videos.map((t) => trackId(view, t)))
  const fragments = top.filter((b) => b.type === 'moof').flatMap((m) => m.children)
  return fragments.some((traf) => {
    const header = child(traf, 'tfhd')
    if (traf.type !== 'traf' || !header || !ids.has(field(view, header, 4, 4))) return false
    return traf.children.some((b) => b.type === 'trun' && field(view, b, 4, 4) > 0)
  })
}

export function checkMp4(bytes: Uint8Array): Mp4Details {
  if (bytes.byteLength > MAX_VIDEO_BYTES) refuse(MP4_REFUSED.tooLarge)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (bytes.byteLength < 8 || typeAt(view, 4) !== 'ftyp') refuse(MP4_REFUSED.notMp4)
  const top = walk(view, 0, bytes.byteLength, 1, { n: 0 })
  if (top[0]?.type !== 'ftyp') refuse(MP4_REFUSED.notMp4)
  const moov = top.find((b) => b.type === 'moov') ?? refuse(MP4_REFUSED.noVideo)
  const tracks = moov.children.filter((b) => b.type === 'trak')
  const handlers = tracks.map((t) => handlerOf(view, t))
  const videos = tracks.filter((_, i) => handlers[i] === 'vide')
  const sizes = videos.map((t) => sizeOf(view, t))
  const first = sizes[0] ?? refuse(MP4_REFUSED.noVideo)
  if (sizes.some((s) => s.width > MAX_VIDEO_SIDE || s.height > MAX_VIDEO_SIDE)) {
    refuse(MP4_REFUSED.tooBig)
  }
  const durationMs = durationOf(view, moov)
  if (durationMs > MAX_VIDEO_MS) refuse(MP4_REFUSED.tooLong)
  if (!hasFrames(view, top, videos)) refuse(MP4_REFUSED.noFrames)
  return { ...first, durationMs, hasSound: handlers.includes('soun') }
}
