// spec/brief-brand.md "The rules" and "Shared helpers" (A-406): a brief's brand colours on a
// new master's text. Each text layer's colour becomes the nearest brand colour, by the rule the
// AI layout uses with a palette, so the text-colours check passes from the start. A label's
// box colour stays as the layout has it. Pure.
import type { NewLayer } from './types'
import { nearestColour } from '@/shared/generation/nearest-colour'

// Fresh copies; with no colours, and for every layer that is not text, unchanged.
export function withBrandColours(
  layers: readonly NewLayer[],
  colours: readonly string[],
): NewLayer[] {
  return layers.map((layer) => {
    const copy = structuredClone(layer)
    if (colours.length > 0 && copy.type === 'text' && 'color' in copy.style) {
      copy.style.color = nearestColour(copy.style.color, colours)
    }
    return copy
  })
}
