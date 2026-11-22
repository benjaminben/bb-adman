// P7-20 (spec/phases/phase-07-slices-2.md): a clip drag in whole milliseconds, in 100 ms
// steps, kept inside the clip's own bounds (spec/phases/phase-07.md, "Clips and the track"),
// then judged by the track rules before anything is sent. A drop on a free place moves the
// clip; a drop that overlaps and has passed the middle of another clip reorders the track
// (A-181); any other overlap snaps back.
import { MAX_TRACK_MS, MIN_CLIP_MS } from '@/shared/schemas/commands/clip'
import { clipEnd, overlapsAny, type TrackClip } from '@/shared/clips/track'
import { stepsOf } from '@/renderer/editor/timeline-math/timeline-math'

export { stepsOf }

export type ClipKind = 'image' | 'video'

export type Judgement =
  { kind: 'back' } | { kind: 'update'; startMs: number } | { kind: 'reorder'; clipIds: string[] }

export type TrimJudgement =
  { kind: 'back' } | { kind: 'update'; change: Partial<Omit<TrackClip, 'id'>> }

const clamp = (n: number, low: number, high: number) => Math.min(Math.max(n, low), high)

export function moveBy(clip: TrackClip, deltaMs: number): TrackClip {
  return { ...clip, startMs: clamp(clip.startMs + deltaMs, 0, MAX_TRACK_MS) }
}

// The start end: a video's start moves its in point with it; a still has no file to cut, so
// its length changes instead.
export function trimStartBy(clip: TrackClip, deltaMs: number, kind: ClipKind): TrackClip {
  const length = clip.outMs - clip.inMs
  const low = kind === 'video' ? Math.max(-clip.startMs, -clip.inMs) : -clip.startMs
  const d = clamp(deltaMs, low, length - MIN_CLIP_MS)
  if (kind === 'video') return { ...clip, startMs: clip.startMs + d, inMs: clip.inMs + d }
  return { ...clip, startMs: clip.startMs + d, outMs: clip.outMs - d }
}

// The far end: never under 100 ms long, and for a video never past its file's end.
export function trimEndBy(clip: TrackClip, deltaMs: number, fileMs: number | null): TrackClip {
  const high = fileMs ?? MAX_TRACK_MS
  return { ...clip, outMs: clamp(clip.outMs + deltaMs, clip.inMs + MIN_CLIP_MS, high) }
}

const middle = (c: TrackClip) => (c.startMs + clipEnd(c)) / 2

function orderOf(track: readonly TrackClip[]): string[] {
  return [...track]
    .sort((a, b) => middle(a) - middle(b) || a.id.localeCompare(b.id))
    .map((c) => c.id)
}

// `next` is the dragged clip at its drop place; `track` holds every clip as stored.
export function judgeMove(next: TrackClip, track: readonly TrackClip[]): Judgement {
  const stored = track.find((c) => c.id === next.id)
  if (stored?.startMs === next.startMs) return { kind: 'back' }
  if (!overlapsAny(next, track)) return { kind: 'update', startMs: next.startMs }
  const before = orderOf(track)
  const after = orderOf(track.map((c) => (c.id === next.id ? next : c)))
  if (after.join() === before.join()) return { kind: 'back' }
  return { kind: 'reorder', clipIds: after }
}

export function judgeTrim(
  stored: TrackClip,
  next: TrackClip,
  track: readonly TrackClip[],
): TrimJudgement {
  const keys = ['startMs', 'inMs', 'outMs'] as const
  const change = Object.fromEntries(
    keys.filter((k) => next[k] !== stored[k]).map((k) => [k, next[k]]),
  )
  if (Object.keys(change).length === 0 || overlapsAny(next, track)) return { kind: 'back' }
  return { kind: 'update', change }
}
