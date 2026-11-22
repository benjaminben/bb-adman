// P7-19 (spec/phases/phase-07-slices-2.md): the timeline's pure math, shared by the layer
// tracks and the clip track. A lane is the variant's length across its width. Every time is a
// whole millisecond. A drag snaps the edge it moves to the playhead when the edge is near it,
// else to 100 ms; a key step is not snapped. No span gets shorter than 100 ms.

export const STEP_MS = 100
export const MIN_SPAN_MS = 100
// How near, in pixels, a dragged edge must come to the playhead to land on it.
export const SNAP_PX = 6

export type Span = { startMs: number; endMs: number }
export type Bounds = { lowMs: number; highMs: number }
// Present on a drag: snap to 100 ms, and to the playhead when it is given and near.
export type Snap = { playheadMs?: number; nearMs?: number }

const clamp = (n: number, low: number, high: number) => Math.min(Math.max(n, low), high)

// A pointer's move across the lane, in whole milliseconds.
export function pxToMs(px: number, laneWidth: number, durationMs: number): number {
  if (laneWidth <= 0) return 0
  return Math.round((px / laneWidth) * durationMs) || 0
}

// A pointer's move across the lane, in 100 ms steps.
export function stepsOf(px: number, laneWidth: number, durationMs: number): number {
  if (laneWidth <= 0) return 0
  return Math.round((px / laneWidth) * (durationMs / STEP_MS)) * STEP_MS || 0
}

const nearPlayhead = (ms: number, snap: Snap | undefined) =>
  snap?.playheadMs !== undefined && Math.abs(ms - snap.playheadMs) <= (snap.nearMs ?? 0)

export function snapTime(ms: number, snap?: Snap): number {
  if (nearPlayhead(ms, snap)) return snap!.playheadMs!
  return Math.round(ms / STEP_MS) * STEP_MS || 0
}

const snapped = (ms: number, snap: Snap | undefined) => (snap ? snapTime(ms, snap) : ms)

export function moveSpan(span: Span, deltaMs: number, bounds: Bounds, snap?: Snap): Span {
  const length = span.endMs - span.startMs
  let startMs = span.startMs + deltaMs
  if (snap && nearPlayhead(startMs, snap)) startMs = snap.playheadMs!
  else if (snap && nearPlayhead(startMs + length, snap)) startMs = snap.playheadMs! - length
  else startMs = snapped(startMs, snap)
  startMs = clamp(startMs, bounds.lowMs, Math.max(bounds.lowMs, bounds.highMs - length))
  return { startMs, endMs: startMs + length }
}

export function resizeStart(span: Span, deltaMs: number, bounds: Bounds, snap?: Snap): Span {
  const startMs = snapped(span.startMs + deltaMs, snap)
  return { ...span, startMs: clamp(startMs, bounds.lowMs, span.endMs - MIN_SPAN_MS) }
}

export function resizeEnd(span: Span, deltaMs: number, bounds: Bounds, snap?: Snap): Span {
  const endMs = snapped(span.endMs + deltaMs, snap)
  return { ...span, endMs: clamp(endMs, span.startMs + MIN_SPAN_MS, bounds.highMs) }
}

// Shifted into the bounds, and shortened when it is longer than they are.
export function fitInside(span: Span, bounds: Bounds): Span {
  const length = Math.min(span.endMs - span.startMs, bounds.highMs - bounds.lowMs)
  const startMs = clamp(span.startMs, bounds.lowMs, bounds.highMs - length)
  return { startMs, endMs: startMs + length }
}
