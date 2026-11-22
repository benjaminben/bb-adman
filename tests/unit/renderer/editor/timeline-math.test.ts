// spec/phases/phase-07-slices-2.md, P7-19: the timeline's pure math. Pixels become whole
// milliseconds; a dragged edge snaps to the playhead when it is near it, else to 100 ms; a span
// moves or resizes inside its bounds and never gets shorter than 100 ms.
import { describe, expect, it } from 'vitest'
import {
  fitInside,
  moveSpan,
  pxToMs,
  resizeEnd,
  resizeStart,
  snapTime,
  stepsOf,
  type Span,
} from '@/renderer/editor/timeline-math/timeline-math'

const span = (startMs: number, endMs: number): Span => ({ startMs, endMs })
const LANE = { lowMs: 0, highMs: 8000 }
const AT_3000 = { playheadMs: 3000, nearMs: 60 }

describe('pxToMs and stepsOf: pixels on a lane to whole milliseconds', () => {
  it.each([
    [0, 800, 8000, 0, 0],
    [43, 800, 8000, 430, 400],
    [-46, 800, 8000, -460, -500],
    [1, 300, 1000, 3, 0],
    [10, 0, 8000, 0, 0],
  ])('%i px on a %i px lane of %i ms is %i ms, %i ms in steps', (px, w, d, ms, steps) => {
    expect(pxToMs(px, w, d)).toBe(ms)
    expect(stepsOf(px, w, d)).toBe(steps)
  })
})

describe('snapTime: to the playhead when near, else to 100 ms', () => {
  it.each([
    [1234, null, 1200],
    [1250, null, 1300],
    [2950, AT_3000, 3000],
    [3060, AT_3000, 3000],
    [3070, AT_3000, 3100],
    [-40, null, 0],
  ])('%i with %o is %i', (ms, snap, out) => {
    expect(snapTime(ms, snap ?? undefined)).toBe(out)
  })
})

describe('moving and resizing a span', () => {
  it.each([
    ['moves by a key step', moveSpan(span(1000, 3000), 100, LANE), span(1100, 3100)],
    [
      'a drag snaps its start to 100 ms',
      moveSpan(span(1000, 3000), 430, LANE, {}),
      span(1400, 3400),
    ],
    [
      'a start near the playhead lands on it',
      moveSpan(span(1000, 2000), 1970, LANE, AT_3000),
      span(3000, 4000),
    ],
    [
      'an end near the playhead lands on it',
      moveSpan(span(1000, 2000), 1030, LANE, AT_3000),
      span(2000, 3000),
    ],
    ['stops at the lane start', moveSpan(span(1000, 3000), -5000, LANE), span(0, 2000)],
    ['stops at the lane end', moveSpan(span(1000, 3000), 9000, LANE), span(6000, 8000)],
    ['start resizes', resizeStart(span(1000, 3000), 500, LANE), span(1500, 3000)],
    ['start keeps 100 ms', resizeStart(span(1000, 3000), 5000, LANE), span(2900, 3000)],
    ['start stops at the bounds', resizeStart(span(1000, 3000), -2000, LANE), span(0, 3000)],
    [
      'start snaps to the playhead',
      resizeStart(span(1000, 4000), 1980, LANE, AT_3000),
      span(3000, 4000),
    ],
    ['end resizes', resizeEnd(span(1000, 3000), -1000, LANE), span(1000, 2000)],
    ['end keeps 100 ms', resizeEnd(span(1000, 3000), -5000, LANE), span(1000, 1100)],
    ['end stops at the bounds', resizeEnd(span(1000, 3000), 9000, LANE), span(1000, 8000)],
    ['a key step needs no grid', resizeEnd(span(1000, 3050), 100, LANE), span(1000, 3150)],
  ])('%s', (_, got, want) => {
    expect(got).toEqual(want)
  })
})

describe('fitInside: a span shifted, then shortened, into bounds', () => {
  it.each([
    [span(500, 1000), { lowMs: 1000, highMs: 4000 }, span(1000, 1500)],
    [span(3800, 4500), { lowMs: 1000, highMs: 4000 }, span(3300, 4000)],
    [span(0, 9000), { lowMs: 1000, highMs: 4000 }, span(1000, 4000)],
    [span(2000, 2500), { lowMs: 1000, highMs: 4000 }, span(2000, 2500)],
  ])('%o inside %o is %o', (s, bounds, want) => {
    expect(fitInside(s, bounds)).toEqual(want)
  })
})
