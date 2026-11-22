// layoutPatches (spec/ai-jobs.md "Layout proposal", applying): turns a layout job's boxes into
// the updates of one layer.updateMany, so one undo entry puts the text back. Pure. R2E-2: a box
// the contrast check gave a text box adds its colour and padding (round-2-editor.md D2). R2E-3:
// a box with a type style adds its weight, capitals and spacing, never a font (D3).
import { typeStylePatch } from '@/shared/config/type-styles'
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
      fontWeight?: number
      allCaps?: boolean
      letterSpacing?: number
    }
  }
}

// The style's three fields; its fontAssetId is left out, so a layout keeps the user's font.
function lookOf(id: NonNullable<LayoutJobBox['typeStyle']>) {
  const { fontWeight, allCaps, letterSpacing } = typeStylePatch(id)
  return { fontWeight, allCaps, letterSpacing }
}

export function layoutPatches(boxes: LayoutJobBox[], layers: LayerRef[]): LayoutPatch[] {
  const textByKey = new Map(layers.filter((l) => l.type === 'text').map((l) => [l.key, l.id]))
  return boxes.flatMap((box) => {
    const layerId = textByKey.get(box.slot)
    if (!layerId) return []
    const { x, y, width, height, fontSize, align, color, boxColor, boxPadding, typeStyle } = box
    const style = {
      fontSize,
      align,
      ...(color !== null ? { color } : {}),
      ...(boxColor !== undefined ? { boxColor } : {}),
      ...(boxPadding !== undefined ? { boxPadding } : {}),
      ...(typeStyle ? lookOf(typeStyle) : {}),
    }
    return [{ layerId, patch: { geometry: { x, y, width, height, rotation: 0 }, style } }]
  })
}

// R2E-2: how many boxes put on a text layer had their colour changed or got a text box.
export function changedCount(boxes: LayoutJobBox[], layers: LayerRef[]): number {
  const keys = new Set(layers.filter((l) => l.type === 'text').map((l) => l.key))
  return boxes.filter((b) => keys.has(b.slot) && (b.readable === 'colour' || b.readable === 'box'))
    .length
}
