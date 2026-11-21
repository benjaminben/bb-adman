// spec/editor.md, "Layer list": what the list's buttons and keys send. Each action is one
// command, so one undo entry on the variant's list (spec/editor-commands.md, "Undo"). The app
// store's command shows a refusal in the error banner.
import { useCallback } from 'react'
import { useApp } from '@/renderer/app/app-context'
import type { LayerRow } from '@/shared/schemas/rows/layer'

export type LayerPatch = { name?: string; visible?: boolean; locked?: boolean }

export function useLayerActions(projectId: string, variantId: string) {
  const command = useApp((s) => s.command)

  // Resolves to the new layer's ID, or null when refused.
  const create = useCallback(
    async (type: 'text' | 'image'): Promise<string | null> => {
      const result = await command('layer.create', { projectId, variantId, type })
      if (!result.ok) return null
      return (result.data as { layerId: string }).layerId
    },
    [command, projectId, variantId],
  )

  const update = useCallback(
    (layerId: string, patch: LayerPatch) =>
      void command('layer.update', { projectId, layerId, patch }),
    [command, projectId],
  )

  const remove = useCallback(
    (layer: LayerRow) => {
      if (layer.type === 'background' || layer.locked) return
      void command('layer.delete', { projectId, layerId: layer.id })
    },
    [command, projectId],
  )

  const reorder = useCallback(
    (layerIds: string[] | null) => {
      if (layerIds) void command('layer.reorder', { projectId, variantId, layerIds })
    },
    [command, projectId, variantId],
  )

  return { create, update, remove, reorder }
}
