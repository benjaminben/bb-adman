// P7-19: what a preset or length change does to an entrance or exit block. A block that has no
// length yet is placed when it gets a preset: half a second long, an entrance at the layer's
// start, an exit ending at the layer's end. A block that has a place keeps it. A new length
// keeps an entrance's start and an exit's end. Every block stays inside the layer's timing.
import { fitInside, type Span } from '@/renderer/editor/timeline-math/timeline-math'
import { blockSpan, boundsOf, toBlock, type BlockKind } from '@/renderer/editor/timing-bar'
import type { AnimationBlock } from '@/shared/schemas/layer'

export const FIRST_LENGTH_MS = 500

type Preset = AnimationBlock['preset']

function placed(kind: BlockKind, preset: Preset, lengthMs: number, layer: Span): AnimationBlock {
  const startMs = kind === 'entrance' ? layer.startMs : layer.endMs - lengthMs
  return toBlock(preset, fitInside({ startMs, endMs: startMs + lengthMs }, boundsOf(layer)))
}

export function withPreset(
  kind: BlockKind,
  block: AnimationBlock,
  preset: Preset,
  layer: Span,
): AnimationBlock {
  if (preset === 'none' || block.durationMs > 0) return { ...block, preset }
  return placed(kind, preset, FIRST_LENGTH_MS, layer)
}

export function withLength(
  kind: BlockKind,
  block: AnimationBlock,
  lengthMs: number,
  layer: Span,
): AnimationBlock {
  const { startMs, endMs } = blockSpan(block)
  const from = kind === 'entrance' ? startMs : endMs - lengthMs
  const span = fitInside({ startMs: from, endMs: from + lengthMs }, boundsOf(layer))
  return toBlock(block.preset, span)
}
