// A-177 (P7-5): the width, height and duration of an imported MP4 or MOV, read by the app's
// own box reader. The file is untrusted: the top-level boxes are found by reading each
// header in place, at most MAX_BOXES of them, and only the moov box is read whole, when it
// holds at most MAX_MOOV_BYTES. The walk keeps checkMp4's depth and side limits. Any fault
// gives null, and nothing read from the file reaches a message.
import type fs from 'node:fs'
import { MAX_VIDEO_SIDE } from '@/main/providers/picture-limits'
import {
  durationOf,
  handlerOf,
  MAX_BOXES,
  MP4_REFUSED,
  refuse,
  sizeOf,
  typeAt,
  walk,
} from '@/main/providers/mp4-boxes'

export const MAX_MOOV_BYTES = 32 * 1024 * 1024

export type VideoFileFacts = {
  width: number
  height: number
  durationMs: number
  hasSound: boolean
}

type ReadableFile = Pick<fs.promises.FileHandle, 'read' | 'stat'>

async function readAt(handle: ReadableFile, at: number, length: number): Promise<DataView> {
  const buffer = new Uint8Array(length)
  const { bytesRead } = await handle.read(buffer, 0, length, at)
  if (bytesRead !== length) refuse(MP4_REFUSED.badBox)
  return new DataView(buffer.buffer)
}

type Found = { at: number; size: number; boxes: number }

// The moov box's place and size, from the top-level box headers alone. A size of 0 means
// the box runs to the end of the file.
async function findMoov(handle: ReadableFile, fileSize: number): Promise<Found | null> {
  let at = 0
  let boxes = 0
  while (at < fileSize) {
    const left = fileSize - at
    boxes += 1
    if (left < 8 || boxes > MAX_BOXES) return null
    const head = await readAt(handle, at, Math.min(16, left))
    let size = head.getUint32(0)
    let headerSize = 8
    if (size === 1) {
      if (left < 16) return null
      const large = head.getBigUint64(8)
      if (large > BigInt(left)) return null
      size = Number(large)
      headerSize = 16
    } else if (size === 0) {
      size = left
    }
    if (size < headerSize || size > left) return null
    if (typeAt(head, 4) === 'moov') return { at, size, boxes }
    at += size
  }
  return null
}

function factsOfMoov(view: DataView, boxesBefore: number): VideoFileFacts {
  const [moov = refuse(MP4_REFUSED.noVideo)] = walk(view, 0, view.byteLength, 1, {
    n: boxesBefore - 1,
  })
  const tracks = moov.children.filter((b) => b.type === 'trak')
  const handlers = tracks.map((t) => handlerOf(view, t))
  const videos = tracks.filter((_, i) => handlers[i] === 'vide')
  const sizes = videos.map((t) => sizeOf(view, t))
  const first = sizes[0] ?? refuse(MP4_REFUSED.noVideo)
  if (sizes.some((s) => s.width > MAX_VIDEO_SIDE || s.height > MAX_VIDEO_SIDE)) {
    refuse(MP4_REFUSED.tooBig)
  }
  const durationMs = durationOf(view, moov)
  if (!Number.isSafeInteger(durationMs)) refuse(MP4_REFUSED.tooLong)
  return { ...first, durationMs, hasSound: handlers.includes('soun') }
}

// The facts of the video in the open file, or null when it has no readable video track.
export async function videoFileFacts(handle: ReadableFile): Promise<VideoFileFacts | null> {
  try {
    const { size } = await handle.stat()
    const found = await findMoov(handle, size)
    if (!found || found.size > MAX_MOOV_BYTES) return null
    return factsOfMoov(await readAt(handle, found.at, found.size), found.boxes)
  } catch {
    return null
  }
}
