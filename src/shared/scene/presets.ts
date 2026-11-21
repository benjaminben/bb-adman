// phase-07.md "Presets" [A-187]: what an animation preset does to a text layer at a progress.
// Pure: the same inputs always give the same state, so the same time gives the same picture
// (spec/scene.md, R-14). No timers, no CSS animation, no clock.
import type { AnimationBlock } from '@/shared/schemas/layer'

export type Preset = AnimationBlock['preset']
export type Phase = 'entrance' | 'exit'
// dx and dy in variant pixels, applied with a translate (a word span uses top).
export type PresetState = { opacity: number; dx: number; dy: number }
export type VariantSize = { width: number; height: number }

export const FULL_STATE: PresetState = { opacity: 1, dx: 0, dy: 0 }

const clamp = (p: number) => Math.min(1, Math.max(0, p))

// How much of the layer is shown: e(p) = 1 - (1 - p)^3 entering, 1 - p^3 leaving.
function shownAt(phase: Phase, progress: number): number {
  const p = clamp(progress)
  return phase === 'entrance' ? 1 - (1 - p) ** 3 : 1 - p ** 3
}

// Word i of n starts at 0.5 x i / (n - 1) of the block and takes half of it.
function wordProgress(progress: number, wordIndex: number, wordCount: number): number {
  return clamp((clamp(progress) - (0.5 * wordIndex) / Math.max(wordCount - 1, 1)) / 0.5)
}

export function presetState(
  preset: Preset,
  phase: Phase,
  progress: number,
  wordIndex: number,
  wordCount: number,
  variantSize: VariantSize,
): PresetState {
  if (preset === 'none') return FULL_STATE
  const own = preset === 'stagger-words' ? wordProgress(progress, wordIndex, wordCount) : progress
  const e = shownAt(phase, own)
  if (preset === 'fade') return { opacity: e, dx: 0, dy: 0 }
  if (preset === 'slide') return { opacity: e, dx: -(1 - e) * 0.1 * variantSize.width, dy: 0 }
  return { opacity: e, dx: 0, dy: (1 - e) * 0.05 * variantSize.height }
}
