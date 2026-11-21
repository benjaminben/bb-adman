// spec/starter-layouts.md "Applying a layout" [D-094]: a starter layout as the updates of one
// layer.updateMany for a variant. Layers are matched by key, the slot ID in every master and
// fanned-out variant. A locked layer, a layer the layout does not name and a layer of the
// wrong type are left out. Pure; the boxes and styles come from layout-rules.ts.
import type { LayerPatch, LayerUpdateManyInput } from '@/shared/schemas/commands/layer'
import type { Geometry, Shade } from '@/shared/schemas/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import {
  BACKGROUND_LAYOUT,
  BACKGROUND_SLOT_ID,
  type LayoutSlot,
  type StarterLayout,
} from '@/shared/config/default-layout'
import { frameOf, geometryOf, textLayoutStyleOf, type Frame } from './layout-rules'

export type StarterLayoutUpdate = LayerUpdateManyInput['updates'][number]
type Layer = Pick<LayerRow, 'id' | 'key' | 'type' | 'locked' | 'copy'>

const shadeCopy = (shade: Shade | null | undefined): Shade | null => (shade ? { ...shade } : null)

// The box with rotation 0 and no crop, so a crop the layer has stays.
function placed({ x, y, width, height, rotation }: Geometry): NonNullable<LayerPatch['geometry']> {
  return { x, y, width, height, rotation }
}

function slotPatch(layer: Layer, slot: LayoutSlot, f: Frame): LayerPatch | null {
  const geometry = geometryOf(slot.box, f)
  if (slot.text) {
    if (layer.type !== 'text') return null
    const rule = { ...slot, text: slot.text }
    const style = textLayoutStyleOf(rule, layer.copy, geometry, f)
    return { geometry: placed(geometry), style }
  }
  if (layer.type !== 'image') return null
  return { geometry: placed(geometry), style: { shade: shadeCopy(slot.shade) } }
}

function patchOf(layout: StarterLayout, layer: Layer, f: Frame): LayerPatch | null {
  if (layer.locked) return null
  if (layer.key === BACKGROUND_SLOT_ID) {
    if (layer.type !== 'background') return null
    const { fillColor, shade } = layout.background
    const geometry = placed(geometryOf(BACKGROUND_LAYOUT.box, f))
    return { geometry, style: { fillColor, shade: shadeCopy(shade) } }
  }
  const slot = Object.hasOwn(layout.slots, layer.key) ? layout.slots[layer.key] : undefined
  return slot ? slotPatch(layer, slot, f) : null
}

export function starterLayoutPatches(
  layout: StarterLayout,
  size: { width: number; height: number },
  layers: readonly Layer[],
): StarterLayoutUpdate[] {
  const f = frameOf(size)
  const updates: StarterLayoutUpdate[] = []
  for (const layer of layers) {
    const patch = patchOf(layout, layer, f)
    if (patch) updates.push({ layerId: layer.id, patch })
  }
  return updates
}
