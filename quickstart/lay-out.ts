// Step 2.6 of spec/quickstart.md: a variant laid out by the brief's layout for its own size and
// its own words, as the app's "Layout…" action does (starterLayoutPatches, merged field by field
// as layer.update merges them). The patches keep each text's font but set its colour from the
// layout, so the brand colours are put back after (withBrandColours, as on the master). A
// picture layer keeps its picture. Pure.
import type { StarterLayout } from '@/shared/config/default-layout'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { withBrandColours } from '@/shared/templates/brand-colours'
import {
  starterLayoutPatches,
  type StarterLayoutUpdate,
} from '@/shared/templates/starter-layout-patches'
import type { Variant } from './layers'

function merged(layer: LayerRow, patch: StarterLayoutUpdate['patch'] | undefined): LayerRow {
  if (!patch) return layer
  const style = { ...layer.style, ...patch.style } as LayerRow['style']
  return { ...layer, style, geometry: { ...layer.geometry, ...patch.geometry } }
}

export function laidOut(variant: Variant, layout: StarterLayout, colours: string[]): Variant {
  const updates = starterLayoutPatches(layout, variant.size, variant.layers)
  const patches = new Map(updates.map((update) => [update.layerId, update.patch]))
  const placed = variant.layers.map((layer) => merged(layer, patches.get(layer.id)))
  const coloured = withBrandColours(placed, colours)
  const layers = placed.map((layer, at) => {
    const style = coloured[at]?.style
    return style ? ({ ...layer, style } as LayerRow) : layer
  })
  return { ...variant, layers }
}
