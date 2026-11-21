// phase-07.md "Presets" and "Clips and the track": a layer is drawn while
// startMs <= t < (endMs ?? durationMs); timing applies to video variants only [A-188]; the
// poster time is the latest end of an entrance block, at most durationMs - 1, or 0 [A-183].
import { describe, expect, it } from 'vitest'
import {
  activeBlock,
  blockProgress,
  drawnTime,
  posterTimeMs,
  visibleAt,
} from '@/shared/scene/timing'
import type { AnimationBlock } from '@/shared/schemas/layer'

const timed = (startMs: number, endMs: number | null) => ({ timing: { startMs, endMs } })
const block = (preset: AnimationBlock['preset'], startMs: number, durationMs: number) => ({
  preset,
  startMs,
  durationMs,
})
const NONE = block('none', 0, 0)

describe('visibleAt', () => {
  it.each([
    ['before the start', timed(1000, 3000), 999, false],
    ['at the start', timed(1000, 3000), 1000, true],
    ['just before the end', timed(1000, 3000), 2999, true],
    ['at the end', timed(1000, 3000), 3000, false],
    ['a null end, inside the variant', timed(0, null), 3999, true],
    ['a null end, at the variant end', timed(0, null), 4000, false],
    ['past the duration, an end set later than it', timed(0, 9000), 5000, false],
  ])('%s', (_case, layer, t, shown) => {
    expect(visibleAt(layer, t, 4000)).toBe(shown)
  })
})

describe('blockProgress', () => {
  it.each([
    ['before the block', block('fade', 1000, 1000), 500, 0],
    ['at its start', block('fade', 1000, 1000), 1000, 0],
    ['a quarter in', block('fade', 1000, 1000), 1250, 0.25],
    ['at its end', block('fade', 1000, 1000), 2000, 1],
    ['after it', block('fade', 1000, 1000), 5000, 1],
    ['no length, before', block('fade', 1000, 0), 999, 0],
    ['no length, at its start', block('fade', 1000, 0), 1000, 1],
  ])('%s', (_case, b, t, progress) => {
    expect(blockProgress(b, t)).toBe(progress)
  })
})

describe('activeBlock', () => {
  const both = { entrance: block('fade', 0, 1000), exit: block('slide', 3000, 1000) }
  it.each([
    [
      'the entrance before the exit starts',
      both,
      500,
      { preset: 'fade', phase: 'entrance', progress: 0.5 },
    ],
    ['the exit once it starts', both, 3500, { preset: 'slide', phase: 'exit', progress: 0.5 }],
    [
      'the entrance when the exit is none',
      { entrance: block('fade', 0, 1000), exit: block('none', 0, 500) },
      3500,
      { preset: 'fade', phase: 'entrance', progress: 1 },
    ],
    [
      'none for both',
      { entrance: NONE, exit: NONE },
      10,
      { preset: 'none', phase: 'entrance', progress: 1 },
    ],
  ])('%s', (_case, animation, t, want) => {
    expect(activeBlock(animation, t)).toEqual(want)
  })
})

describe('drawnTime [A-188]', () => {
  it('an image variant ignores timing: no time to draw at', () => {
    expect(drawnTime({ format: 'image' }, 2500)).toBeNull()
  })
  it('a video variant is drawn at the given time', () => {
    expect(drawnTime({ format: 'video' }, 2500)).toBe(2500)
  })
})

describe('posterTimeMs [A-183]', () => {
  const layer = (entrance: AnimationBlock) => ({ animation: { entrance, exit: NONE } })
  it.each([
    ['no layers', [], 8000, 0],
    ['only none entrances', [layer(block('none', 500, 1000))], 8000, 0],
    [
      'the latest entrance end',
      [layer(block('fade', 0, 1000)), layer(block('slide', 500, 2000))],
      8000,
      2500,
    ],
    ['held to durationMs - 1', [layer(block('fade', 7000, 2000))], 8000, 7999],
  ])('%s', (_case, layers, durationMs, want) => {
    expect(posterTimeMs(layers, durationMs)).toBe(want)
  })
})
