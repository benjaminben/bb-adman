// The video ad's background as an FFmpeg filter graph (spec/export-and-checks.md "Video variant",
// steps 4 and 5): a black base, each clip trimmed to its time range, scaled and cropped as
// placePicture puts it, overlaid, then the frame stream (input 0) on top.
// Security (spec/phases/phase-08.md "Video"): the graph holds only numbers formatted here and
// fixed names. No path, file name or other project text goes in, and assertSafeGraph checks it.
// Clips are shifted in time by input options (-ss, -itsoffset in encoder-args.ts), not setpts:
// a setpts expression needs capitals, `+` and `/`, which the character rule refuses.
import { placePicture, type Size } from '@/shared/scene/background-placement'
import type { Geometry } from '@/shared/schemas/layer'

export type GraphClip = {
  still: boolean
  // The source picture's own pixels.
  source: Size
  startMs: number
  inMs: number
  outMs: number
  // null = the background layer's geometry.
  placement: Geometry | null
}

// One clip that shows: its time on the track, cut to the ad, and where its pixels go.
export type PlannedClip<T extends GraphClip> = {
  clip: T
  startMs: number
  endMs: number
  scale: { w: number; h: number }
  crop: { w: number; h: number; x: number; y: number }
  at: { x: number; y: number }
}

const SAFE_GRAPH = /^[0-9a-z_=:,;[\].-]*$/
const LIMIT = 1e9

function finite(n: number): number {
  if (!Number.isFinite(n) || Math.abs(n) > LIMIT) throw new Error('Not a usable number.')
  return n
}

// A whole number as text, from a number the builder checked.
export function whole(n: number): string {
  return String(Math.round(finite(n)))
}

// Milliseconds as seconds with three decimals.
export function seconds(ms: number): string {
  return (Math.round(finite(ms)) / 1000).toFixed(3)
}

export function assertSafeGraph(graph: string): void {
  if (!SAFE_GRAPH.test(graph) || /movie/.test(graph)) {
    throw new Error('The filter graph holds a character or a filter that is not allowed.')
  }
}

// Where a clip's pixels go on the canvas, or null when none of its box is left.
function place(
  clip: GraphClip,
  background: Geometry,
): Omit<PlannedClip<GraphClip>, 'clip' | 'startMs' | 'endMs'> | null {
  const box = clip.placement ?? background
  const boxW = Math.round(finite(box.width))
  const boxH = Math.round(finite(box.height))
  const p = placePicture(clip.source, box.crop, { width: box.width, height: box.height }, 'cover')
  const w = Math.round(finite(p.width))
  const h = Math.round(finite(p.height))
  const px = Math.round(finite(p.x))
  const py = Math.round(finite(p.y))
  const left = Math.max(0, px)
  const top = Math.max(0, py)
  const right = Math.min(boxW, px + w)
  const bottom = Math.min(boxH, py + h)
  if (right <= left || bottom <= top) return null
  return {
    scale: { w, h },
    crop: { w: right - left, h: bottom - top, x: left - px, y: top - py },
    at: { x: Math.round(finite(box.x)) + left, y: Math.round(finite(box.y)) + top },
  }
}

// The clips that show, in track order. A clip is cut at the ad's end; one with no time or no
// pixels left is left out (and so is not an input either).
export function planClips<T extends GraphClip>(
  clips: T[],
  background: Geometry,
  durationMs: number,
): PlannedClip<T>[] {
  const end = finite(durationMs)
  const planned: PlannedClip<T>[] = []
  for (const clip of [...clips].sort((a, b) => a.startMs - b.startMs)) {
    const startMs = Math.max(0, finite(clip.startMs))
    const endMs = Math.min(end, finite(clip.startMs) + finite(clip.outMs) - finite(clip.inMs))
    if (endMs <= startMs) continue
    const where = place(clip, background)
    if (where) planned.push({ clip, startMs, endMs, ...where })
  }
  return planned
}

// Clip k is FFmpeg input k + 1; the frame stream is input 0.
export function filterGraph(
  planned: PlannedClip<GraphClip>[],
  size: Size,
  durationMs: number,
  fps: 30 | 60,
): string {
  const parts = [
    `color=c=black:s=${whole(size.width)}x${whole(size.height)}:r=${whole(fps)}:d=${seconds(durationMs)}[bg0]`,
  ]
  planned.forEach((c, k) => {
    const { scale, crop, at } = c
    parts.push(
      `[${k + 1}:v]trim=start=${seconds(c.startMs)}:end=${seconds(c.endMs)},` +
        `scale=w=${whole(scale.w)}:h=${whole(scale.h)},` +
        `crop=w=${whole(crop.w)}:h=${whole(crop.h)}:x=${whole(crop.x)}:y=${whole(crop.y)}[c${k}]`,
      `[bg${k}][c${k}]overlay=x=${whole(at.x)}:y=${whole(at.y)}:eof_action=pass[bg${k + 1}]`,
    )
  })
  parts.push(`[bg${planned.length}][0:v]overlay=x=0:y=0:eof_action=pass[out]`)
  const graph = parts.join(';')
  assertSafeGraph(graph)
  return graph
}
