// The track rules (spec/phases/phase-07.md, "Clips and the track", A-180, A-181), pure: the
// clip commands use them, and the renderer uses them to judge a drag before sending it. A
// clip covers [startMs, startMs + outMs - inMs) on the track.

export type TrackClip = { id: string; startMs: number; inMs: number; outMs: number }

export const clipLength = (c: Pick<TrackClip, 'inMs' | 'outMs'>): number => c.outMs - c.inMs

export const clipEnd = (c: Omit<TrackClip, 'id'>): number => c.startMs + clipLength(c)

// True when the clip's span meets another clip's span. The clip's own ID is left out, so a
// changed clip is judged against the others only.
export function overlapsAny(c: TrackClip, track: readonly TrackClip[]): boolean {
  const end = clipEnd(c)
  return track.some((o) => o.id !== c.id && c.startMs < clipEnd(o) && o.startMs < end)
}

// The earliest time from 0 at which a clip fits without overlap. The length may depend on
// where the clip starts (a still runs to the variant's end), so it is asked at each place
// tried: 0 and the end of each clip, earliest first. After the last clip there is always room.
export function firstFreeStart(
  track: readonly TrackClip[],
  lengthAt: (startMs: number) => number,
): number {
  const places = [0, ...track.map(clipEnd)].sort((a, b) => a - b)
  for (const startMs of places) {
    const length = lengthAt(startMs)
    if (!overlapsAny({ id: '', startMs, inMs: 0, outMs: length }, track)) return startMs
  }
  return places[places.length - 1] ?? 0
}

// A-181: the clips back to back in the given order, from the earliest start among them.
export function reorderLayout(
  ordered: readonly TrackClip[],
): Array<{ id: string; startMs: number }> {
  let at = Math.min(...ordered.map((c) => c.startMs))
  return ordered.map((c) => {
    const placed = { id: c.id, startMs: at }
    at += clipLength(c)
    return placed
  })
}
