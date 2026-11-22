// SPEC 6.10.7 "What applies to a video file" [REQ: FR-262, FR-283] (security class), with the
// 1.39 sound rule: the one check of a video file from any provider, before it is stored. It
// reads box headers and a few header fields only, and never decodes. Each refusal is a plain
// Error with a fixed message, so nothing from the file reaches a message.
import { MAX_VIDEO_BYTES, MAX_VIDEO_MS, MAX_VIDEO_SIDE } from './picture-limits'
import {
  durationOf,
  handlerOf,
  hasFrames,
  MP4_REFUSED,
  refuse,
  sizeOf,
  typeAt,
  walk,
} from './mp4-boxes'

export { MP4_REFUSED }

export type Mp4Details = { width: number; height: number; durationMs: number; hasSound: boolean }

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
