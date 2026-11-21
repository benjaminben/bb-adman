// phase-07.md "Presets" and "Clips and the track": when a layer is drawn and which animation
// block is under a time. Timing and presets apply to video variants only [A-188]. Pure.
import type { Animation, AnimationBlock, Timing } from '@/shared/schemas/layer'
import type { SceneVariant } from '@/shared/scene/types'
import type { Phase, Preset } from '@/shared/scene/presets'

export type ActiveBlock = { preset: Preset; phase: Phase; progress: number }

// The time a variant is drawn at, or null when timing does not apply (an image variant).
export function drawnTime(variant: Pick<SceneVariant, 'format'>, timeMs: number): number | null {
  return variant.format === 'video' ? timeMs : null
}

// startMs <= t < (endMs ?? durationMs). Nothing is drawn past the variant's end.
export function visibleAt(layer: { timing: Timing }, t: number, durationMs: number): boolean {
  const end = Math.min(layer.timing.endMs ?? durationMs, durationMs)
  return layer.timing.startMs <= t && t < end
}

// 0 to 1 over the block; a block with no length is done from its start.
export function blockProgress(block: AnimationBlock, t: number): number {
  if (block.durationMs <= 0) return t >= block.startMs ? 1 : 0
  return Math.min(1, Math.max(0, (t - block.startMs) / block.durationMs))
}

// The exit block once it has started (when it has a preset), else the entrance block.
export function activeBlock(animation: Animation, t: number): ActiveBlock {
  const { entrance, exit } = animation
  if (exit.preset !== 'none' && t >= exit.startMs) {
    return { preset: exit.preset, phase: 'exit', progress: blockProgress(exit, t) }
  }
  return { preset: entrance.preset, phase: 'entrance', progress: blockProgress(entrance, t) }
}

// A-183: the latest end of an entrance block with a preset, at most durationMs - 1, or 0.
export function posterTimeMs(layers: { animation: Animation }[], durationMs: number): number {
  const ends = layers
    .map((layer) => layer.animation.entrance)
    .filter((block) => block.preset !== 'none')
    .map((block) => block.startMs + block.durationMs)
  const latest = Math.max(0, ...ends)
  return Math.max(0, Math.min(latest, durationMs - 1))
}
