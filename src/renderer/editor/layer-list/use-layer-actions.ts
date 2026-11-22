// spec/editor.md, "Layer list": what the list's buttons, keys and row menus send. Each action is
// one command, so one undo entry on the variant's list (spec/editor-commands.md, "Undo"). The app
// store's command shows a refusal in the error banner. Duplicate, Bring forward and Send backward
// send what the properties panel sends (ED-1a).
import { useCallback } from 'react'
import { useApp } from '@/renderer/app/app-context'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { stepped } from './stack-order'

export type LayerPatch = { name?: string; visible?: boolean; locked?: boolean }

const DUPLICATE_OFFSET = 20

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

// `order` is the non-background layer IDs, lowest first (stack-order.ts).
export function useLayerActions(projectId: string, variantId: string, order: string[]) {
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

  const duplicate = useCallback(
    (layer: LayerRow) => {
      if (layer.type === 'background') return
      const values = duplicateValues(layer)
      void command('layer.create', { projectId, variantId, type: layer.type, values })
    },
    [command, projectId, variantId],
  )

  const forward = (layerId: string) => reorder(stepped(order, layerId, 1))
  const backward = (layerId: string) => reorder(stepped(order, layerId, -1))

  return { create, update, remove, reorder, duplicate, forward, backward }
}
