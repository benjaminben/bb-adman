// spec/editor.md, "Crop mode" [FR-077, FR-094]: the crop in source pixels. It keeps the shape
// of the layer's box (aspect = width ÷ height), so placePicture shows it exactly, and it stays
// inside the picture. Pure.
import type { Placement, Size } from '@/shared/scene/background-placement'
import { PULL, type Handle, type Point } from '@/renderer/editor/geometry-math'

export type Rect = { x: number; y: number; width: number; height: number }

const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high)

// The crop cut to the picture, as placePicture does; null when nothing of it is left.
function cut(source: Size, crop: Rect): Rect | null {
  const left = Math.max(crop.x, 0)
  const top = Math.max(crop.y, 0)
  const right = Math.min(crop.x + crop.width, source.width)
  const bottom = Math.min(crop.y + crop.height, source.height)
  if (right <= left || bottom <= top) return null
  return { x: left, y: top, width: right - left, height: bottom - top }
}

// The largest rectangle of the given shape in the middle of the region.
function fitShape(region: Rect, aspect: number): Rect {
  const width = Math.min(region.width, region.height * aspect)
  const height = width / aspect
  return {
    x: region.x + (region.width - width) / 2,
    y: region.y + (region.height - height) / 2,
    width,
    height,
  }
}

// The smallest crop width: 1 source pixel on the short side.
const minWidth = (aspect: number) => Math.max(1, aspect)

// Where crop mode starts: the part of the layer's crop (or of the whole picture) that the box
// shows, at the box's shape.
export function startCrop(source: Size, crop: Rect | null, box: Size): Rect {
  const whole = { x: 0, y: 0, width: source.width, height: source.height }
  const region = (crop && cut(source, crop)) ?? whole
  return fitShape(region, box.width / box.height)
}

export function moveCrop(start: Rect, delta: Point, source: Size): Rect {
  return {
    ...start,
    x: clamp(start.x + delta.x, 0, source.width - start.width),
    y: clamp(start.y + delta.y, 0, source.height - start.height),
  }
}

// How far a side may reach from its fixed point along one axis: up to the edge it pulls
// towards, or about the middle when the handle does not pull on that axis.
function reach(pull: number, low: number, size: number, limit: number): number {
  if (pull < 0) return low + size
  if (pull > 0) return limit - low
  const middle = low + size / 2
  return 2 * Math.min(middle, limit - middle)
}

// Where a side starts once resized, from the side or middle that stays put.
const settle = (pull: number, low: number, size: number, next: number) =>
  pull < 0 ? low + size - next : pull > 0 ? low : low + (size - next) / 2

// A handle resizes the crop at the given shape; the opposite side or corner stays put, and a
// side handle grows about the middle of the other axis. The larger change of the two sides wins.
export function resizeCrop(
  start: Rect,
  handle: Handle,
  delta: Point,
  source: Size,
  aspect: number,
): Rect {
  const pull = PULL[handle]
  const fx = pull.x === 0 ? 1 : (start.width + pull.x * delta.x) / start.width
  const fy = pull.y === 0 ? 1 : (start.height + pull.y * delta.y) / start.height
  const f = Math.abs(fx - 1) >= Math.abs(fy - 1) ? fx : fy
  const most = Math.min(
    reach(pull.x, start.x, start.width, source.width),
    reach(pull.y, start.y, start.height, source.height) * aspect,
  )
  const width = Math.min(Math.max(start.width * f, minWidth(aspect)), most)
  const height = width / aspect
  return {
    x: settle(pull.x, start.x, start.width, width),
    y: settle(pull.y, start.y, start.height, height),
    width,
    height,
  }
}

// The keyboard's resize: the width changes by `by` about the middle, then the crop is moved
// back inside the picture. Never larger than the largest box shape inside the picture.
export function growCrop(start: Rect, by: number, source: Size, aspect: number): Rect {
  const most = Math.min(source.width, source.height * aspect)
  const width = clamp(start.width + by, Math.min(minWidth(aspect), most), most)
  const height = width / aspect
  const grown = {
    x: start.x + (start.width - width) / 2,
    y: start.y + (start.height - height) / 2,
    width,
    height,
  }
  return moveCrop(grown, { x: 0, y: 0 }, source)
}

// A rectangle in source pixels, in the box's own pixels where placePicture puts the picture.
export function toBoxPixels(rect: Rect, place: Placement, source: Size): Rect {
  const k = place.width / source.width
  return {
    x: place.x + rect.x * k,
    y: place.y + rect.y * k,
    width: rect.width * k,
    height: rect.height * k,
  }
}
