// spec/editor.md, "Keyboard shortcuts" [FR-097]: Delete or Backspace deletes the selected layer
// (not the background, not a locked layer); Mod+D duplicates it ("{name} copy", 20 px right and
// down, on top); the arrows nudge it, gathered into one update (nudge.ts).
import { useEffect, useMemo } from 'react'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { VariantStore } from '@/renderer/stores/variant-store'
import { useEditorKey } from '@/renderer/editor/use-editor-key'
import { NUDGES, createNudgeBurst, type NudgeName } from '@/renderer/editor/nudge'
import { sendGeometry, type Command } from './send-geometry'

type Args = {
  projectId: string
  variantId: string
  store: VariantStore
  command: Command
  selected: LayerRow | null
  onSelect: (layerId: string) => void
}

const DUPLICATE_OFFSET_PX = 20
const NAME_MAX = 100
const COPY_SUFFIX = ' copy'

// The new layer's values: the layer's own, renamed and moved. A text layer has no `source`
// key and a picture layer no `copy` key (layer.create refuses them).
function duplicateValues(layer: LayerRow) {
  const { geometry } = layer
  const values = {
    name: layer.name.slice(0, NAME_MAX - COPY_SUFFIX.length) + COPY_SUFFIX,
    style: layer.style,
    geometry: {
      ...geometry,
      x: geometry.x + DUPLICATE_OFFSET_PX,
      y: geometry.y + DUPLICATE_OFFSET_PX,
    },
    visible: layer.visible,
    locked: layer.locked,
  }
  return layer.type === 'text'
    ? { ...values, copy: layer.copy ?? '' }
    : { ...values, source: layer.source }
}

export function useLayerKeys({ projectId, variantId, store, command, selected, onSelect }: Args) {
  const burst = useMemo(
    () => createNudgeBurst(() => void sendGeometry(store, command, projectId)),
    [store, command, projectId],
  )
  const selectedId = selected?.id ?? null

  // A gathered nudge is sent when the selection changes, and when the editor closes.
  useEffect(() => () => burst.flush(), [burst, selectedId])

  function nudge(name: NudgeName) {
    if (!selected || selected.locked) return
    const { x, y } = selected.geometry
    const at = burst.press(selected.id, { x, y }, NUDGES[name])
    store.getState().setDraft(selected.id, at)
  }

  useEditorKey('nudgeLeft', () => nudge('nudgeLeft'))
  useEditorKey('nudgeRight', () => nudge('nudgeRight'))
  useEditorKey('nudgeUp', () => nudge('nudgeUp'))
  useEditorKey('nudgeDown', () => nudge('nudgeDown'))
  useEditorKey('nudgeLeftFar', () => nudge('nudgeLeftFar'))
  useEditorKey('nudgeRightFar', () => nudge('nudgeRightFar'))
  useEditorKey('nudgeUpFar', () => nudge('nudgeUpFar'))
  useEditorKey('nudgeDownFar', () => nudge('nudgeDownFar'))

  useEditorKey('deleteLayer', () => {
    if (!selected || selected.type === 'background' || selected.locked) return
    void command('layer.delete', { projectId, layerId: selected.id })
  })

  useEditorKey('duplicate', () => {
    if (!selected || selected.type === 'background') return
    const input = { projectId, variantId, type: selected.type, values: duplicateValues(selected) }
    void command('layer.create', input).then((result) => {
      const made = result.ok ? (result.data as { layerId?: string } | null)?.layerId : undefined
      if (made) onSelect(made)
    })
  })

  return { flush: () => burst.flush() }
}
