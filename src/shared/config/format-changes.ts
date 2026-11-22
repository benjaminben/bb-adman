// The one table of allowed format changes (spec/data-rules.md, "Changing a variant's format").
// variant.setFormat looks a change up here and nowhere else knows which directions exist.
// takenReason is the grid test's refusal when the direction already has a variant at the
// same size and language in the target format.
import type { VideoReason } from '@/shared/video/messages'

export type Format = 'image' | 'video'

export type FormatChange = { from: Format; to: Format; takenReason: VideoReason }

export const FORMAT_CHANGES: readonly FormatChange[] = [
  { from: 'image', to: 'video', takenReason: 'video_post_exists' }, // D-012
  { from: 'video', to: 'image', takenReason: 'image_post_exists' }, // D-020
]

export function formatChange(from: Format, to: Format): FormatChange | null {
  return FORMAT_CHANGES.find((c) => c.from === from && c.to === to) ?? null
}
