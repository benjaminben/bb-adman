// Review leftovers, layer.update: the timing and animation numbers an agent or a project file
// can send are bounded, from 0 to the longest variant (MAX_DURATION_MS). The stored row shape
// is not changed.
import { describe, expect, it } from 'vitest'
import { layerUpdateInput } from '@/shared/schemas/commands/layer'
import { MAX_DURATION_MS } from '@/shared/schemas/commands/variant'

const block = { preset: 'fade', startMs: 0, durationMs: 400 }
const update = (patch: Record<string, unknown>) => ({ projectId: 'P', layerId: 'L', patch })
const timing = (startMs: number, endMs: number | null) => update({ timing: { startMs, endMs } })
const entrance = (b: Record<string, unknown>) =>
  update({ animation: { entrance: { ...block, ...b } } })

const over = MAX_DURATION_MS + 1

describe('layer.update bounds the timing and animation numbers', () => {
  it.each([
    ['a timing start below 0', timing(-1, null)],
    ['a timing start past the longest variant', timing(over, null)],
    ['a timing end below 0', timing(0, -1)],
    ['a timing end past the longest variant', timing(0, over)],
    ['an animation start below 0', entrance({ startMs: -1 })],
    ['an animation start past the longest variant', entrance({ startMs: over })],
    ['an animation length below 0', entrance({ durationMs: -1 })],
    ['an animation length past the longest variant', entrance({ durationMs: over })],
  ])('refuses %s', (_name, input) => {
    expect(layerUpdateInput.safeParse(input).success).toBe(false)
  })

  it.each([
    ['a timing from the start to the end', timing(0, null)],
    ['a timing at the bounds', timing(0, MAX_DURATION_MS)],
    ['a timing inside the variant', timing(1200, 4800)],
    ['an animation block', entrance({})],
    ['an animation at the bounds', entrance({ startMs: MAX_DURATION_MS, durationMs: 0 })],
  ])('still takes %s', (_name, input) => {
    expect(layerUpdateInput.safeParse(input).success).toBe(true)
  })
})
