// P7-9: the pure track rules (spec/phases/phase-07.md, "Clips and the track", A-181).
import { describe, it, expect } from 'vitest'
import {
  clipEnd,
  clipLength,
  firstFreeStart,
  overlapsAny,
  reorderLayout,
  type TrackClip,
} from '@/shared/clips/track'

const clip = (id: string, startMs: number, lengthMs: number, inMs = 0): TrackClip => ({
  id,
  startMs,
  inMs,
  outMs: inMs + lengthMs,
})

describe('clip length and end', () => {
  it('is outMs - inMs, and ends at startMs plus that length', () => {
    const c = clip('a', 1000, 2000, 500)
    expect(clipLength(c)).toBe(2000)
    expect(clipEnd(c)).toBe(3000)
  })
})

describe('overlapsAny: spans are [startMs, startMs + length) [A-180]', () => {
  const track = [clip('a', 1000, 1000), clip('b', 4000, 1000)]
  it.each([
    ['ends where a starts', clip('x', 0, 1000), false],
    ['starts where a ends', clip('x', 2000, 1000), false],
    ['fills the gap exactly', clip('x', 2000, 2000), false],
    ['starts inside a', clip('x', 1500, 1000), true],
    ['ends inside b', clip('x', 3000, 1001), true],
    ['covers a', clip('x', 500, 2000), true],
    ['inside a', clip('x', 1200, 100), true],
    ['the same span as a', clip('x', 1000, 1000), true],
  ])('%s: %s', (_, c, expected) => {
    expect(overlapsAny(c, track)).toBe(expected)
  })

  it('leaves out the clip itself, by ID', () => {
    expect(overlapsAny(clip('a', 1200, 1000), track)).toBe(false)
  })
})

describe('firstFreeStart: the earliest time from 0 at which the length fits', () => {
  const fixed = (n: number) => () => n
  it.each([
    ['an empty track', [], 3000, 0],
    ['room before the first clip', [clip('a', 5000, 1000)], 3000, 0],
    ['no room before the first clip', [clip('a', 2000, 1000)], 3000, 3000],
    ['a gap that fits', [clip('a', 0, 1000), clip('b', 4000, 1000)], 3000, 1000],
    ['a gap too small', [clip('a', 0, 1000), clip('b', 3000, 1000)], 3000, 4000],
    ['clips given out of order', [clip('b', 4000, 1000), clip('a', 0, 1000)], 3000, 1000],
  ])('%s', (_, track, length, expected) => {
    expect(firstFreeStart(track, fixed(length))).toBe(expected)
  })

  it('asks the length for each place it tries', () => {
    const track = [clip('a', 0, 2000), clip('b', 5000, 1000)]
    // The time left to an 8,000 ms end: 6,000 at 2,000 does not fit; 2,000 at 6,000 does.
    expect(firstFreeStart(track, (start) => 8000 - start)).toBe(6000)
  })
})

describe('reorderLayout: back to back from the earliest start, in the given order [A-181]', () => {
  it('lays the clips in the order given, gaps closed', () => {
    const a = clip('a', 1000, 2000)
    const b = clip('b', 5000, 500)
    const c = clip('c', 9000, 1000, 300)
    expect(reorderLayout([c, a, b])).toEqual([
      { id: 'c', startMs: 1000 },
      { id: 'a', startMs: 2000 },
      { id: 'b', startMs: 4000 },
    ])
  })

  it('gives nothing for no clips', () => {
    expect(reorderLayout([])).toEqual([])
  })
})
