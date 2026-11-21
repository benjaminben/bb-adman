// spec/editor.md, "Crop mode" [FR-077, FR-094]: which layer is cropped, how crop mode starts and
// how it ends. It starts by a double-click on a picture layer that has a picture, or by "Crop…"
// in the properties panel; never for a locked layer. It ends when the layer goes away, is
// locked, loses its picture or is no longer selected. "Done" sends one
// layer.update { geometry: { crop } } in source pixels (one undo step); "Cancel" sends nothing.
import { useEffect, type MouseEvent } from 'react'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { SceneAsset } from '@/shared/scene/types'
import { pickLayer } from '@/renderer/editor/geometry-math'
import type { Command } from '@/renderer/editor/canvas-overlay/send-geometry'
import type { Rect } from './crop-math'

type Args = {
  projectId: string
  command: Command
  layers: LayerRow[]
  assets: Readonly<Record<string, SceneAsset>>
  selected: LayerRow | null
  scale: number
  // The layer in crop mode, or null.
  cropId: string | null
  onCrop: (layerId: string | null) => void
  onSelect: (layerId: string | null) => void
}

// The picture of a layer that may be cropped, or null.
function croppable(layer: LayerRow | null, assets: Args['assets']): SceneAsset | null {
  if (!layer || layer.type === 'text' || layer.locked || !layer.source) return null
  const asset = assets[layer.source.assetId]
  return asset && asset.kind === 'image' && !asset.missing ? asset : null
}

const same = (a: Rect | null, b: Rect) =>
  a !== null && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height

export function useCropMode(args: Args) {
  const { selected, cropId, onCrop } = args
  const picture = selected?.id === cropId ? croppable(selected, args.assets) : null
  const layer = picture ? selected : null

  useEffect(() => {
    if (cropId !== null && !layer) onCrop(null)
  }, [cropId, layer, onCrop])

  return {
    layer,
    url: picture?.url ?? null,
    // A double-click on the Scene, in screen pixels from the stage's corner.
    enter(event: MouseEvent<HTMLElement>) {
      const rect = event.currentTarget.getBoundingClientRect()
      const point = {
        x: (event.clientX - rect.left) / args.scale,
        y: (event.clientY - rect.top) / args.scale,
      }
      const id = pickLayer(args.layers, point)
      const found = args.layers.find((l) => l.id === id) ?? null
      if (!found || !croppable(found, args.assets)) return
      args.onSelect(found.id)
      onCrop(found.id)
    },
    cancel: () => onCrop(null),
    done(crop: Rect) {
      onCrop(null)
      if (!layer || same(layer.geometry.crop, crop)) return
      const patch = { geometry: { crop } }
      void args.command('layer.update', { projectId: args.projectId, layerId: layer.id, patch })
    },
  }
}
