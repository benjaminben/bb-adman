// spec/editor.md "Layout…" (LK-6): the variant's layers with a starter layout's updates merged
// in, for the dialog's previews only; the saved values come from layer.updateMany. Style and
// geometry are merged field by field, as layer.update merges them, so a crop stays.
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { StarterLayoutUpdate } from '@/shared/templates/starter-layout-patches'

function merged(layer: LayerRow, patch: StarterLayoutUpdate['patch']): LayerRow {
  const style = { ...layer.style, ...patch.style } as LayerRow['style']
  const geometry = { ...layer.geometry, ...patch.geometry }
  return { ...layer, style, geometry }
}

export function applyPatches(layers: LayerRow[], updates: StarterLayoutUpdate[]): LayerRow[] {
  const patches = new Map(updates.map((u) => [u.layerId, u.patch]))
  return layers.map((layer) => {
    const patch = patches.get(layer.id)
    return patch ? merged(layer, patch) : layer
  })
}
