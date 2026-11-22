// Which still a generated clip takes the place of (spec/phases/round-2-editor.md D5), pure.
// The still: the clip whose asset is a picture and is the background layer's current source;
// else the track's only clip when it is a picture; else none. The new clip starts where the
// still started and runs the file's length, cut to fit before the next clip and before the
// post's end. Less than the shortest clip left: none, so the clip goes to the first free place.
import { MIN_CLIP_MS } from '@/shared/schemas/commands/clip'
import type { TrackClip } from '@/shared/clips/track'

// A clip of the track, with whether its asset is a picture.
export type StillTrackClip = TrackClip & { assetId: string; picture: boolean }

export type StillPlan = { stillId: string; startMs: number; lengthMs: number }

type Input = {
  // The variant's clips, by start.
  track: readonly StillTrackClip[]
  backgroundAssetId: string | null
  fileMs: number
  postMs: number
}

function findStill(track: readonly StillTrackClip[], backgroundAssetId: string | null) {
  const own = track.find((c) => c.picture && c.assetId === backgroundAssetId)
  if (own) return own
  const [only] = track
  return track.length === 1 && only?.picture ? only : null
}

export function stillToReplace(input: Input): StillPlan | null {
  const still = findStill(input.track, input.backgroundAssetId)
  if (!still) return null
  const next = input.track.filter((c) => c.id !== still.id && c.startMs >= still.startMs)
  const nextStart = Math.min(...next.map((c) => c.startMs), Infinity)
  const lengthMs = Math.min(input.fileMs, nextStart - still.startMs, input.postMs - still.startMs)
  if (lengthMs < MIN_CLIP_MS) return null
  return { stillId: still.id, startMs: still.startMs, lengthMs }
}
