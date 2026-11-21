import type { Geometry } from '@/shared/schemas/layer'

// spec/scene.md "Pictures": the one owner of where a picture goes inside its box. Pure, so
// Phase 8's FFmpeg filter builder can use it too.
export type Size = { width: number; height: number }
export type PictureFit = 'cover' | 'contain'
export type Placement = { x: number; y: number; width: number; height: number }

type Region = Placement

// The crop cut to the picture; null when there is no crop or nothing of it is left.
function cropRegion(source: Size, crop: Geometry['crop']): Region | null {
  if (!crop) return null
  const left = Math.max(crop.x, 0)
  const top = Math.max(crop.y, 0)
  const right = Math.min(crop.x + crop.width, source.width)
  const bottom = Math.min(crop.y + crop.height, source.height)
  if (right <= left || bottom <= top) return null
  return { x: left, y: top, width: right - left, height: bottom - top }
}

// Where the whole source picture goes, in box pixels. No rounding; one scale for both sides.
export function placePicture(
  source: Size,
  crop: Geometry['crop'],
  box: Size,
  fit: PictureFit,
): Placement {
  const cropped = cropRegion(source, crop)
  const region = cropped ?? { x: 0, y: 0, width: source.width, height: source.height }
  const covers = cropped !== null || fit === 'cover'
  const pick = covers ? Math.max : Math.min
  const s = pick(box.width / region.width, box.height / region.height)
  return {
    x: (box.width - region.width * s) / 2 - region.x * s,
    y: (box.height - region.height * s) / 2 - region.y * s,
    width: source.width * s,
    height: source.height * s,
  }
}
