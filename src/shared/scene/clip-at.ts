// P7-8, phase-07.md "Clips and the track": the clip under a time on a video variant's
// background track and its source time, inMs + t - startMs. Nothing in a gap or past the
// variant's end. Clip rows may come from someone else's project file and never passed the clip
// commands, so every stored number is rounded and clamped here before it is drawn. Pure.
import type { Geometry } from '@/shared/schemas/layer'
import { MAX_TRACK_MS } from '@/shared/schemas/commands/clip'
import { MAX_SIZE_SIDE } from '@/shared/config/size-limits'
import type { SceneClip } from '@/shared/scene/types'

export type ClipAt = { clip: SceneClip; sourceMs: number }

// The furthest a placement may reach or offset, in variant pixels.
const MAX_PLACE = MAX_SIZE_SIDE * 4

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (Number.isNaN(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

const trackMs = (value: number) => clamp(value, 0, MAX_TRACK_MS, 0)

// Null for a clip whose stored times are not all finite, or whose trim has no length.
export function safeClip(clip: SceneClip): SceneClip | null {
  const { startMs, inMs, outMs } = clip
  if (![startMs, inMs, outMs].every(Number.isFinite)) return null
  const safe = { ...clip, startMs: trackMs(startMs), inMs: trackMs(inMs), outMs: trackMs(outMs) }
  return safe.outMs > safe.inMs ? safe : null
}

const byStart = (a: SceneClip, b: SceneClip) =>
  a.startMs - b.startMs || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

// startMs <= t < startMs + outMs - inMs, and t before the variant's end. Stored clips that
// overlap (a damaged file) give the earliest start, then the lower ID.
export function clipAt(clips: SceneClip[], t: number, durationMs: number): ClipAt | null {
  const at = trackMs(t)
  if (at >= trackMs(durationMs)) return null
  const safe = clips.map(safeClip).filter((c): c is SceneClip => c !== null)
  const clip = safe.sort(byStart).find((c) => c.startMs <= at && at < c.startMs + c.outMs - c.inMs)
  return clip ? { clip, sourceMs: clip.inMs + at - clip.startMs } : null
}

const offset = (value: number) => clamp(value, -MAX_PLACE, MAX_PLACE, 0)
const side = (value: number) => clamp(value, 1, MAX_PLACE, 1)

// A placement in whole pixels, each side at least one pixel; rotation in degrees below 360.
export function safePlacement(geometry: Geometry): Geometry {
  const { x, y, width, height, rotation, crop } = geometry
  const turn = Number.isFinite(rotation) ? rotation % 360 : 0
  return {
    x: offset(x),
    y: offset(y),
    width: side(width),
    height: side(height),
    rotation: turn,
    crop: crop && {
      x: offset(crop.x),
      y: offset(crop.y),
      width: side(crop.width),
      height: side(crop.height),
    },
  }
}
