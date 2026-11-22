// What a video run sends (spec/phases/round-2-editor.md D4, "The run dialog"): the clip's
// length in whole seconds for a provider and a start, and the number of pictures the start
// sends. The run dialog names both in its line and hands the same numbers to its caller, so
// what is shown is what is sent. Pure apart from reading the offer table.
import type { VideoStartKind } from '@/shared/config/video-offers'
import type { ComfyInfo } from '@/shared/schemas/queries/comfy'
import { lengthsFor, picturesFor } from './card-starts'

export type ClipBounds = { min: number; max: number | null }

// The least and most a provider makes for a start: an offer's bounds, ComfyUI's least 1 and
// its workflow's most, else at least 1 and no most.
export function clipBounds(
  info: ComfyInfo | null,
  providerId: string,
  start: VideoStartKind,
): ClipBounds {
  const { min, max } = lengthsFor(info, providerId, start)
  return { min, max }
}

// The length sent: the wanted seconds put inside the provider's bounds and rounded to its step.
export function videoSeconds(
  info: ComfyInfo | null,
  providerId: string,
  start: VideoStartKind,
  wanted: number,
): number {
  const { min, max, step } = lengthsFor(info, providerId, start)
  const inside = Math.min(Math.max(wanted, min), max ?? Infinity)
  const stepped = min + Math.round((inside - min) / step) * step
  return max === null ? stepped : Math.min(stepped, max)
}

// The pictures sent: none from a prompt, one for the background or a first frame, and the
// chosen references cut to the provider's most.
export function videoPictures(providerId: string, start: VideoStartKind, chosen: number): number {
  if (start === 'reference') return Math.min(chosen, picturesFor(providerId, start))
  return start === 'prompt' ? 0 : 1
}
