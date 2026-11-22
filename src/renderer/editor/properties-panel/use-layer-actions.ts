// spec/editor.md, "Properties panel": the one command the panel's sections send for the selected
// layer, a field update. It is one step on the variant's undo list (the main process records
// it). It goes straight to window.api, so its refusal shows under the field only. Rename, hide,
// lock, order, duplicate and delete are on the layer row (ED-1a, ED-1b, choice C-3).
import { useApi } from '@/renderer/app/app-context'
import type { LayerPatch } from '@/shared/schemas/commands/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'

export function useLayerActions(projectId: string, layer: LayerRow) {
  const api = useApi()
  return {
    async update(patch: LayerPatch): Promise<string | null> {
      const result = await api.command('layer.update', { projectId, layerId: layer.id, patch })
      return result.ok ? null : result.error.message
    },
  }
}
