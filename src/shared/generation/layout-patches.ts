// layoutPatches (spec/ai-jobs.md "Layout proposal", applying): turns a layout job's boxes into
// the updates of one layer.updateMany, so one undo entry puts the text back. Pure. R2E-2: a box
// the contrast check gave a text box adds its colour and padding (round-2-editor.md D2).
import type { LayoutJobBox } from '@/shared/schemas/jobs/layout-proposal'

type LayerRef = { id: string; key: string; type: string }

export type LayoutPatch = {
  layerId: string
  patch: {
    geometry: { x: number; y: number; width: number; height: number; rotation: 0 }
    style: {
      fontSize: number
      align: LayoutJobBox['align']
      color?: string
      boxColor?: string
      boxPadding?: number
    }
  }
}

export function layoutPatches(boxes: LayoutJobBox[], layers: LayerRef[]): LayoutPatch[] {
  const textByKey = new Map(layers.filter((l) => l.type === 'text').map((l) => [l.key, l.id]))
  return boxes.flatMap((box) => {
    const layerId = textByKey.get(box.slot)
    if (!layerId) return []
    const { x, y, width, height, fontSize, align, color, boxColor, boxPadding } = box
    const style = {
      fontSize,
      align,
      ...(color !== null ? { color } : {}),
      ...(boxColor !== undefined ? { boxColor } : {}),
      ...(boxPadding !== undefined ? { boxPadding } : {}),
    }
    return [{ layerId, patch: { geometry: { x, y, width, height, rotation: 0 }, style } }]
  })
}
