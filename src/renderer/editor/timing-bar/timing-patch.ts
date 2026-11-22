// P7-19: a layer's timing as a span on its lane, and the one layer.update a timing change
// sends. A null end is drawn to the variant's end, and an end placed at the variant's end is
// sent as null, so the layer keeps lasting to the end when the length changes. A text layer's
// entrance and exit blocks stay inside its timing: a move carries them along, a resize
// pulls them in. A block with no preset has nothing to show and is left as it is.
import { fitInside, type Bounds, type Span } from '@/renderer/editor/timeline-math/timeline-math'
import type { LayerPatch } from '@/shared/schemas/commands/layer'
import type { AnimationBlock, Timing } from '@/shared/schemas/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'

export type BlockKind = 'entrance' | 'exit'
export const BLOCK_KINDS: BlockKind[] = ['entrance', 'exit']

export function timingSpan(timing: Timing, durationMs: number): Span {
  const endMs = Math.min(timing.endMs ?? durationMs, durationMs)
  return { startMs: Math.min(timing.startMs, endMs), endMs }
}

export const boundsOf = ({ startMs, endMs }: Span): Bounds => ({ lowMs: startMs, highMs: endMs })

export const blockSpan = (block: AnimationBlock): Span => ({
  startMs: block.startMs,
  endMs: block.startMs + block.durationMs,
})

export const toBlock = (preset: AnimationBlock['preset'], span: Span): AnimationBlock => ({
  preset,
  startMs: span.startMs,
  durationMs: span.endMs - span.startMs,
})

const sameBlock = (a: AnimationBlock, b: AnimationBlock) =>
  a.preset === b.preset && a.startMs === b.startMs && a.durationMs === b.durationMs

// Where a block goes when its layer's timing becomes `next`: shifted by `shiftMs`, then inside.
export function blockAfter(block: AnimationBlock, shiftMs: number, next: Span): AnimationBlock {
  const { startMs, endMs } = blockSpan(block)
  const moved = { startMs: startMs + shiftMs, endMs: endMs + shiftMs }
  return toBlock(block.preset, fitInside(moved, boundsOf(next)))
}

function blocksAfter(layer: LayerRow, shiftMs: number, next: Span): LayerPatch['animation'] {
  if (layer.type !== 'text') return undefined
  const changed: NonNullable<LayerPatch['animation']> = {}
  for (const kind of BLOCK_KINDS) {
    const block = layer.animation[kind]
    if (block.preset === 'none') continue
    const fitted = blockAfter(block, shiftMs, next)
    if (!sameBlock(fitted, block)) changed[kind] = fitted
  }
  return Object.keys(changed).length > 0 ? changed : undefined
}

// `moved` says the whole bar moved (the blocks go with it) rather than one of its ends.
export function timingPatch(
  layer: LayerRow,
  next: Span,
  durationMs: number,
  moved: boolean,
): LayerPatch | null {
  const before = timingSpan(layer.timing, durationMs)
  if (before.startMs === next.startMs && before.endMs === next.endMs) return null
  const timing = { startMs: next.startMs, endMs: next.endMs >= durationMs ? null : next.endMs }
  const animation = blocksAfter(layer, moved ? next.startMs - before.startMs : 0, next)
  return animation ? { timing, animation } : { timing }
}
