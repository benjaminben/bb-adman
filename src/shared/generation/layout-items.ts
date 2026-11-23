// spec/ai-jobs.md "Layout proposal": what a layout call places, and the size of the picture it
// is sent. Shared by the layout_proposal job and the quickstart CLI. Pure.
import type { LayerRow } from '@/shared/schemas/rows/layer'

// The longest side of the picture sent with a layout call.
export const LAYOUT_PICTURE_SIDE = 1024

// What the provider places: each visible text layer with copy, in the order given (z order).
export function layoutItems(
  layers: Array<Pick<LayerRow, 'type' | 'visible' | 'copy' | 'key'>>,
): Array<{ slot: string; text: string }> {
  return layers
    .filter((l) => l.type === 'text' && l.visible && (l.copy ?? '').trim() !== '')
    .map((l) => ({ slot: l.key, text: l.copy ?? '' }))
}
