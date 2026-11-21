// spec/editor-commands.md, "layer.reorder": the order it takes is every non-background layer ID,
// each once, lowest first. These helpers build the new order for one step (Mod+] and Mod+[) and
// for a drop; each gives null when nothing would change, so no command is sent.
import type { LayerRow } from '@/shared/schemas/rows/layer'

export function topFirst(layers: LayerRow[]): LayerRow[] {
  const rank = (l: LayerRow) => (l.type === 'background' ? -Infinity : l.z)
  return [...layers].sort((a, b) => rank(b) - rank(a) || a.id.localeCompare(b.id))
}

// The non-background layer IDs, lowest first: the list's rows read from the bottom up.
export function stackOrder(layers: LayerRow[]): string[] {
  return topFirst(layers)
    .filter((l) => l.type !== 'background')
    .map((l) => l.id)
    .reverse()
}

// Moves one layer to a new index in the order (counted after taking it out).
export function placed(order: string[], id: string, index: number): string[] | null {
  const from = order.indexOf(id)
  if (from < 0) return null
  const rest = order.filter((other) => other !== id)
  const to = Math.max(0, Math.min(rest.length, index))
  if (to === from) return null
  return [...rest.slice(0, to), id, ...rest.slice(to)]
}

// One step up (+1, bring forward) or down (-1, send backward).
export function stepped(order: string[], id: string, step: 1 | -1): string[] | null {
  const from = order.indexOf(id)
  if (from < 0 || from + step < 0 || from + step >= order.length) return null
  return placed(order, id, from + step)
}

// A drop on a row: above it (visually) is one place higher in the stack. A drop on the
// background puts the layer at the bottom of the stack, just above the background.
export function dropped(
  order: string[],
  id: string,
  targetId: string,
  above: boolean,
): string[] | null {
  if (!order.includes(targetId)) return placed(order, id, 0)
  const rest = order.filter((other) => other !== id)
  const at = rest.indexOf(targetId)
  if (at < 0) return null
  return placed(order, id, above ? at + 1 : at)
}
