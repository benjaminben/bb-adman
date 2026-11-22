// spec/phases/phase-07-slices-2.md, P7-20: a clip drag is turned into whole milliseconds in
// 100 ms steps, kept inside the clip's own bounds, and judged by src/shared/clips/track.ts
// before anything is sent: a free place moves the clip, an overlap past another clip reorders,
// any other overlap snaps back.
import { describe, expect, it } from 'vitest'
import {
  judgeMove,
  judgeTrim,
  moveBy,
  stepsOf,
  trimEndBy,
  trimStartBy,
} from '@/renderer/editor/clip-block/clip-drag'
import type { TrackClip } from '@/shared/clips/track'

const c = (id: string, startMs: number, inMs: number, outMs: number): TrackClip => ({
  id,
  startMs,
  inMs,
  outMs,
})

describe('stepsOf: pixels to whole milliseconds in 100 ms steps', () => {
  it.each([
    [0, 800, 8000, 0],
    [40, 800, 8000, 400],
    [43, 800, 8000, 400],
    [-46, 800, 8000, -500],
    [10, 0, 8000, 0],
  ])('%i px on a %i px lane of %i ms is %i ms', (px, width, durationMs, ms) => {
    expect(stepsOf(px, width, durationMs)).toBe(ms)
  })
})

describe('moving and trimming keep a clip inside its bounds', () => {
  const video = c('K1', 1000, 500, 2500)
  it.each([
    ['move right', moveBy(video, 300), c('K1', 1300, 500, 2500)],
    ['move left past 0 stops at 0', moveBy(video, -5000), c('K1', 0, 500, 2500)],
    ['video start trim in', trimStartBy(video, 400, 'video'), c('K1', 1400, 900, 2500)],
    [
      'video start trim out stops at the file start',
      trimStartBy(video, -900, 'video'),
      c('K1', 500, 0, 2500),
    ],
    ['video start trim keeps 100 ms', trimStartBy(video, 5000, 'video'), c('K1', 2900, 2400, 2500)],
    [
      'still start trim changes its length',
      trimStartBy(c('S', 1000, 0, 2000), -400, 'image'),
      c('S', 600, 0, 2400),
    ],
    [
      'still start trim stops at 0',
      trimStartBy(c('S', 300, 0, 2000), -900, 'image'),
      c('S', 0, 0, 2300),
    ],
    ['end trim in keeps 100 ms', trimEndBy(video, -5000, 3000), c('K1', 1000, 500, 600)],
    [
      'video end trim stops at the file end',
      trimEndBy(video, 2000, 3000),
      c('K1', 1000, 500, 3000),
    ],
    [
      'still end trim has no file end',
      trimEndBy(c('S', 0, 0, 2000), 4000, null),
      c('S', 0, 0, 6000),
    ],
  ])('%s', (_name, got, want) => {
    expect(got).toEqual(want)
  })
})

describe('judgeMove and judgeTrim [src/shared/clips/track.ts]', () => {
  const a = c('A', 0, 0, 1000)
  const b = c('B', 1000, 0, 1000)
  const far = c('F', 5000, 0, 1000)
  const track = [a, b, far]

  it('sends clip.update for a free place', () => {
    expect(judgeMove(moveBy(a, 2500), track)).toEqual({ kind: 'update', startMs: 2500 })
  })
  it('sends nothing for the place it already has', () => {
    expect(judgeMove(a, track)).toEqual({ kind: 'back' })
  })
  it('reorders when an overlapping drop passes the middle of another clip', () => {
    expect(judgeMove(moveBy(a, 1200), track)).toEqual({
      kind: 'reorder',
      clipIds: ['B', 'A', 'F'],
    })
  })
  it('snaps back when an overlapping drop has not passed another clip', () => {
    expect(judgeMove(moveBy(a, 300), track)).toEqual({ kind: 'back' })
  })
  it('sends a trim that fits and snaps back a trim that overlaps', () => {
    expect(judgeTrim(a, trimEndBy(a, -300, null), track)).toEqual({
      kind: 'update',
      change: { outMs: 700 },
    })
    expect(judgeTrim(b, trimStartBy(b, 200, 'video'), track)).toEqual({
      kind: 'update',
      change: { startMs: 1200, inMs: 200 },
    })
    expect(judgeTrim(b, trimEndBy(b, 3500, null), track)).toEqual({ kind: 'back' })
    expect(judgeTrim(b, b, track)).toEqual({ kind: 'back' })
  })
})
