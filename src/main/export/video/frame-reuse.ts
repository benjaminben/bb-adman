// When a video ad's overlay frame is the same as the one before (spec/export-and-checks.md
// "Video variant" step 2): no animation running and no layer starting or ending between the two
// frame times. Built from Phase 7's timing functions, so it agrees with what the Scene draws.
// Only the frames the app itself draws (the overlay stream) are reused; clip pixels are FFmpeg's
// and never pass through here. Pure: frame times come from the frame number, never a clock.
import { frameTimeMs } from '@/shared/export/frames'
import { drawnTime, activeBlock, visibleAt } from '@/shared/scene/timing'
import type { SceneInput } from '@/shared/scene/types'
import type { LayerRow } from '@/shared/schemas/rows/layer'

type Timed = Pick<SceneInput, 'variant' | 'layers'>

// What of a layer can change with time: shown or not, and its animation's state.
function stateAt(layer: LayerRow, t: number, durationMs: number): string {
  const shown = visibleAt(layer, t, durationMs)
  const { preset, phase, progress } = activeBlock(layer.animation, t)
  return preset === 'none' ? `${shown}` : `${shown}|${preset}|${phase}|${progress}`
}

function sameAt(scene: Timed, before: number, now: number): boolean {
  const { durationMs } = scene.variant
  return scene.layers.every(
    (layer) => stateAt(layer, before, durationMs) === stateAt(layer, now, durationMs),
  )
}

// sameAsPrevious for the frame pipe: true when frame i draws what frame i - 1 drew.
export function frameReuse(scene: Timed, fps: 30 | 60): (i: number) => boolean {
  return (i) => {
    if (!Number.isInteger(i) || i < 1) return false
    const before = drawnTime(scene.variant, frameTimeMs(i - 1, fps))
    const now = drawnTime(scene.variant, frameTimeMs(i, fps))
    if (before === null || now === null) return true
    return sameAt(scene, before, now)
  }
}
