// spec/make-variants.md "Which layout": the starter layout a source's boxes still sit in,
// found from where they are, never stored. Pure.
import type { Geometry } from '@/shared/schemas/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { Size } from '@/shared/scene/background-placement'
import type { StarterLayout } from '@/shared/config/default-layout'
import { STARTER_LAYOUTS } from '@/shared/config/starter-layouts'
import { frameOf, geometryOf } from '@/shared/templates/layout-rules'

export type LaidOutLayer = Pick<LayerRow, 'key' | 'type' | 'geometry'>

// The layout's own slot for this key, never one inherited from Object.
const slotOf = (layout: StarterLayout, key: string) =>
  Object.hasOwn(layout.slots, key) ? layout.slots[key] : undefined

// The layout's box for the layer's key at this size; null when the layout does not name it.
export function layoutBoxOf(
  layout: StarterLayout,
  layer: Pick<LayerRow, 'key'>,
  size: Size,
): Geometry | null {
  const slot = slotOf(layout, layer.key)
  return slot ? geometryOf(slot.box, frameOf(size)) : null
}

// The layer's key is a slot of the layout, its type matches the slot's, its rotation is 0 and
// its box equals the layout's box at this size exactly. The background never counts.
export function sitsAsLaidOut(layout: StarterLayout, layer: LaidOutLayer, size: Size): boolean {
  if (layer.type === 'background') return false
  const slot = slotOf(layout, layer.key)
  if (!slot || layer.type !== (slot.text ? 'text' : 'image')) return false
  const box = geometryOf(slot.box, frameOf(size))
  const g = layer.geometry
  return (
    g.rotation === 0 &&
    g.x === box.x &&
    g.y === box.y &&
    g.width === box.width &&
    g.height === box.height
  )
}

// The layout the most layers sit in; a tie goes to preferredId when it is among the tied, else
// to the first in STARTER_LAYOUTS order. Null when no layer sits in any layout.
export function layoutOfLayers(
  layers: readonly LaidOutLayer[],
  size: Size,
  preferredId?: string | null,
): StarterLayout | null {
  const counts = STARTER_LAYOUTS.map(
    (layout) => layers.filter((layer) => sitsAsLaidOut(layout, layer, size)).length,
  )
  const most = Math.max(0, ...counts)
  if (most === 0) return null
  const tied = STARTER_LAYOUTS.filter((_, i) => counts[i] === most)
  return tied.find((layout) => layout.id === preferredId) ?? tied[0] ?? null
}
