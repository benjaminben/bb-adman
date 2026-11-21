// spec/editor.md, "Selecting" and "Moving, resizing and rotating": the geometry of the canvas,
// in variant pixels, worked out from the layers' values, not from the page. Pure.
import type { LayerRow } from '@/shared/schemas/rows/layer'

export type Point = { x: number; y: number }
export type Box = Pick<LayerRow['geometry'], 'x' | 'y' | 'width' | 'height' | 'rotation'>
export type Bounds = { left: number; top: number; right: number; bottom: number }
export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

// Which way each handle pulls along the box's own sides: -1 the left or top, 1 the right or
// bottom, 0 neither.
export const PULL: Record<Handle, Point> = {
  nw: { x: -1, y: -1 },
  n: { x: 0, y: -1 },
  ne: { x: 1, y: -1 },
  e: { x: 1, y: 0 },
  se: { x: 1, y: 1 },
  s: { x: 0, y: 1 },
  sw: { x: -1, y: 1 },
  w: { x: -1, y: 0 },
}

const RAD = Math.PI / 180

const centreOf = (box: Box): Point => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 })

// A vector turned by the given angle in degrees (clockwise on screen, as CSS rotate).
function turn(v: Point, degrees: number): Point {
  const cos = Math.cos(degrees * RAD)
  const sin = Math.sin(degrees * RAD)
  return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos }
}

// The point turned back by the box's angle about its centre, then tested against the box.
export function boxHolds(box: Box, point: Point): boolean {
  const c = centreOf(box)
  const local = turn({ x: point.x - c.x, y: point.y - c.y }, -box.rotation)
  return Math.abs(local.x) <= box.width / 2 && Math.abs(local.y) <= box.height / 2
}

// The topmost visible, unlocked layer whose turned box holds the point; else the background.
export function pickLayer(layers: LayerRow[], point: Point): string | null {
  const pickable = layers.filter((l) => l.visible && !l.locked)
  const above = pickable
    .filter((l) => l.type !== 'background')
    .sort((a, b) => b.z - a.z || b.id.localeCompare(a.id))
    .find((l) => boxHolds(l.geometry, point))
  return above?.id ?? pickable.find((l) => l.type === 'background')?.id ?? null
}

// The axis-aligned bounds of a turned box.
export function boundsOf(box: Box): Bounds {
  const c = centreOf(box)
  const half = turn({ x: box.width / 2, y: box.height / 2 }, box.rotation)
  const other = turn({ x: box.width / 2, y: -box.height / 2 }, box.rotation)
  const dx = Math.max(Math.abs(half.x), Math.abs(other.x))
  const dy = Math.max(Math.abs(half.y), Math.abs(other.y))
  return { left: c.x - dx, top: c.y - dy, right: c.x + dx, bottom: c.y + dy }
}

export function moveBox(box: Box, offset: Point): Box {
  return { ...box, x: box.x + offset.x, y: box.y + offset.y }
}

// Resizes along the box's own turned sides; the opposite side or corner stays put. keepShape
// (Shift) scales both sides by the larger change; a side handle then grows about the middle of
// the other axis. Width and height stay at least 1.
export function resizeBox(start: Box, handle: Handle, delta: Point, keepShape: boolean): Box {
  const pull = PULL[handle]
  const local = turn(delta, -start.rotation)
  let width = Math.max(1, start.width + pull.x * local.x)
  let height = Math.max(1, start.height + pull.y * local.y)
  if (keepShape) {
    const fx = pull.x === 0 ? 0 : width / start.width
    const fy = pull.y === 0 ? 0 : height / start.height
    const f = Math.abs(fx - 1) >= Math.abs(fy - 1) && pull.x !== 0 ? fx : fy
    width = Math.max(1, start.width * f)
    height = Math.max(1, start.height * f)
  }
  // The fixed point, in the box's own frame about its old centre, and the new centre from it.
  const anchor = { x: (-pull.x * start.width) / 2, y: (-pull.y * start.height) / 2 }
  const shift = turn(
    { x: anchor.x + (pull.x * width) / 2, y: anchor.y + (pull.y * height) / 2 },
    start.rotation,
  )
  const c = centreOf(start)
  return {
    x: c.x + shift.x - width / 2,
    y: c.y + shift.y - height / 2,
    width,
    height,
    rotation: start.rotation,
  }
}

// An angle folded into (−180, 180].
export function foldAngle(degrees: number): number {
  const a = ((degrees % 360) + 360) % 360
  const folded = a > 180 ? a - 360 : a
  return folded + 0
}

const angleAt = (centre: Point, p: Point) => Math.atan2(p.x - centre.x, centre.y - p.y) / RAD

// The start angle plus the turn of the pointer about the centre, from `from` to `to`. step
// (Shift) rounds the result to 15°.
export function turnBox(start: number, centre: Point, from: Point, to: Point, step: boolean) {
  const angle = start + angleAt(centre, to) - angleAt(centre, from)
  return foldAngle(step ? Math.round(angle / 15) * 15 : angle)
}
