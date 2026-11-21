// spec/editor.md, "Properties panel" and "Keyboard shortcuts": the commands the panel's sections
// send for the selected layer. Each is one step on the variant's undo list (the main process
// records it). A field update goes straight to window.api, so its refusal shows under the field
// only; the layer actions go through the app store, so a refusal shows in the app's banner.
import { useApi, useApp } from '@/renderer/app/app-context'
import type { LayerPatch } from '@/shared/schemas/commands/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'

const DUPLICATE_OFFSET = 20

// Non-background layer IDs, lowest first: the order layer.reorder takes.
function stacked(layers: LayerRow[]): string[] {
  return layers
    .filter((l) => l.type !== 'background')
    .sort((a, b) => a.z - b.z)
    .map((l) => l.id)
}

function duplicateValues(layer: LayerRow) {
  const { geometry } = layer
  return {
    name: `${layer.name} copy`,
    ...(layer.type === 'text' ? { copy: layer.copy ?? '' } : { source: layer.source }),
    style: layer.style,
    geometry: { ...geometry, x: geometry.x + DUPLICATE_OFFSET, y: geometry.y + DUPLICATE_OFFSET },
    visible: layer.visible,
    locked: layer.locked,
  }
}

export function useLayerActions(projectId: string, layer: LayerRow, layers: LayerRow[]) {
  const api = useApi()
  const command = useApp((s) => s.command)
  const order = stacked(layers)
  const at = order.indexOf(layer.id)

  function move(by: 1 | -1) {
    const layerIds = [...order]
    layerIds[at] = order[at + by]!
    layerIds[at + by] = layer.id
    void command('layer.reorder', { projectId, variantId: layer.variantId, layerIds })
  }

  return {
    canForward: at >= 0 && at < order.length - 1,
    canBackward: at > 0,
    async update(patch: LayerPatch): Promise<string | null> {
      const result = await api.command('layer.update', { projectId, layerId: layer.id, patch })
      return result.ok ? null : result.error.message
    },
    forward: () => move(1),
    backward: () => move(-1),
    duplicate() {
      const { variantId, type } = layer
      void command('layer.create', { projectId, variantId, type, values: duplicateValues(layer) })
    },
    remove: () => void command('layer.delete', { projectId, layerId: layer.id }),
  }
}
