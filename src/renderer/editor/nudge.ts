// spec/editor.md, "Moving, resizing and rotating", Nudge: arrows move the selected layer 1
// pixel, Shift and an arrow 10. Presses are gathered and sent as one update 500 ms after the
// last press, or when the selection changes, so holding a key adds one undo entry. Pure.
import type { ShortcutName } from '@/renderer/ui/shortcuts'
import type { Point } from './geometry-math'

export const NUDGE_DELAY_MS = 500

export const NUDGES = {
  nudgeLeft: { x: -1, y: 0 },
  nudgeRight: { x: 1, y: 0 },
  nudgeUp: { x: 0, y: -1 },
  nudgeDown: { x: 0, y: 1 },
  nudgeLeftFar: { x: -10, y: 0 },
  nudgeRightFar: { x: 10, y: 0 },
  nudgeUpFar: { x: 0, y: -10 },
  nudgeDownFar: { x: 0, y: 10 },
} satisfies Partial<Record<ShortcutName, Point>>

export type NudgeName = keyof typeof NUDGES

export type NudgeBurst = {
  // Adds a step to the layer's gathered place (its place `from` on the first press) and
  // returns the new place.
  press(layerId: string, from: Point, step: Point): Point
  // Sends the gathered place now, if there is one.
  flush(): void
  pending(): string | null
}

export function createNudgeBurst(send: (layerId: string, at: Point) => void): NudgeBurst {
  let burst: { layerId: string; at: Point } | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  function flush() {
    if (timer !== null) clearTimeout(timer)
    timer = null
    const done = burst
    burst = null
    if (done) send(done.layerId, done.at)
  }

  function press(layerId: string, from: Point, step: Point): Point {
    if (burst && burst.layerId !== layerId) flush()
    const base = burst?.at ?? from
    const at = { x: base.x + step.x, y: base.y + step.y }
    burst = { layerId, at }
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(flush, NUDGE_DELAY_MS)
    return at
  }

  return { press, flush, pending: () => burst?.layerId ?? null }
}
