// layoutPatches (spec/ai-jobs.md "Layout proposal", applying): turns a layout job's boxes into
// the updates of one layer.updateMany, so one undo entry puts the text back. Pure.
import type { LayoutJobBox } from '@/shared/schemas/jobs/layout-proposal'

type LayerRef = { id: string; key: string; type: string }

export type LayoutPatch = {
  layerId: string
  patch: {
    geometry: { x: number; y: number; width: number; height: number; rotation: 0 }
    style: { fontSize: number; align: LayoutJobBox['align']; color?: string }
  }
}

export function layoutPatches(boxes: LayoutJobBox[], layers: LayerRef[]): LayoutPatch[] {
  const textByKey = new Map(layers.filter((l) => l.type === 'text').map((l) => [l.key, l.id]))
  return boxes.flatMap((box) => {
    const layerId = textByKey.get(box.slot)
    if (!layerId) return []
    const { x, y, width, height, fontSize, align, color } = box
    const style = { fontSize, align, ...(color !== null ? { color } : {}) }
    return [{ layerId, patch: { geometry: { x, y, width, height, rotation: 0 }, style } }]
  })
}
