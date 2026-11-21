// spec/editor.md, "Selecting": a click picks the topmost layer that is visible, not locked, and
// whose turned box holds the point, worked out from the geometry, not from the page. The
// background is picked when nothing above it is. Pure.
import type { LayerRow } from '@/shared/schemas/rows/layer'

type Point = { x: number; y: number }
type Box = Pick<LayerRow['geometry'], 'x' | 'y' | 'width' | 'height' | 'rotation'>

// The point turned back by the box's angle about its centre, then tested against the box.
export function boxHolds(box: Box, point: Point): boolean {
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const angle = (-box.rotation * Math.PI) / 180
  const dx = point.x - cx
  const dy = point.y - cy
  const rx = dx * Math.cos(angle) - dy * Math.sin(angle)
  const ry = dx * Math.sin(angle) + dy * Math.cos(angle)
  return Math.abs(rx) <= box.width / 2 && Math.abs(ry) <= box.height / 2
}

export function pickLayer(layers: LayerRow[], point: Point): string | null {
  const pickable = layers.filter((l) => l.visible && !l.locked)
  const above = pickable
    .filter((l) => l.type !== 'background')
    .sort((a, b) => b.z - a.z || b.id.localeCompare(a.id))
    .find((l) => boxHolds(l.geometry, point))
  return above?.id ?? pickable.find((l) => l.type === 'background')?.id ?? null
}
