// P8-15 (security class): the background filter graph holds only numbers the builder formats and
// fixed names. No path, file name or other project text reaches it (spec/phases/phase-08.md "Video").
import { describe, expect, it } from 'vitest'
import {
  assertSafeGraph,
  filterGraph,
  planClips,
  type GraphClip,
} from '@/main/export/video/filter-graph'
import type { Geometry } from '@/shared/schemas/layer'

const size = { width: 1080, height: 1920 }
const full: Geometry = { x: 0, y: 0, width: 1080, height: 1920, rotation: 0, crop: null }
const landscape = { width: 1920, height: 1080 }

function clip(over: Partial<GraphClip>): GraphClip {
  return {
    still: false,
    source: landscape,
    startMs: 0,
    inMs: 0,
    outMs: 2000,
    placement: null,
    ...over,
  }
}

function graph(clips: GraphClip[], durationMs = 15000, fps: 30 | 60 = 30): string {
  return filterGraph(planClips(clips, full, durationMs), size, durationMs, fps)
}

const base = 'color=c=black:s=1080x1920:r=30:d=15.000[bg0]'
const frames = (n: number) => `[bg${n}][0:v]overlay=x=0:y=0:eof_action=pass[out]`
// A 1920x1080 source covering a 1080x1920 canvas: scaled to 3413x1920, the middle cut out.
const coverFull = 'scale=w=3413:h=1920,crop=w=1080:h=1920:x=1167:y=0'

describe('filterGraph [P8-15]', () => {
  it.each([
    { name: 'no clip draws black only', clips: [], want: [base, frames(0)] },
    {
      name: 'one video clip is trimmed to its time range',
      clips: [clip({ startMs: 0, inMs: 1500, outMs: 4500 })],
      want: [
        base,
        `[1:v]trim=start=0.000:end=3.000,${coverFull}[c0]`,
        '[bg0][c0]overlay=x=0:y=0:eof_action=pass[bg1]',
        frames(1),
      ],
    },
    {
      name: 'a still is shown for 3 s from its start',
      clips: [clip({ still: true, startMs: 2000, inMs: 0, outMs: 3000 })],
      want: [
        base,
        `[1:v]trim=start=2.000:end=5.000,${coverFull}[c0]`,
        '[bg0][c0]overlay=x=0:y=0:eof_action=pass[bg1]',
        frames(1),
      ],
    },
    {
      name: 'two clips with a gap leave black between them',
      clips: [
        clip({ startMs: 5000, inMs: 0, outMs: 3000 }),
        clip({ startMs: 0, inMs: 0, outMs: 2000 }),
      ],
      want: [
        base,
        `[1:v]trim=start=0.000:end=2.000,${coverFull}[c0]`,
        '[bg0][c0]overlay=x=0:y=0:eof_action=pass[bg1]',
        `[2:v]trim=start=5.000:end=8.000,${coverFull}[c1]`,
        '[bg1][c1]overlay=x=0:y=0:eof_action=pass[bg2]',
        frames(2),
      ],
    },
    {
      name: 'a clip with its own placement is drawn in that box',
      clips: [
        clip({
          source: { width: 1000, height: 1000 },
          placement: { x: 100, y: 200, width: 500, height: 500, rotation: 0, crop: null },
        }),
      ],
      want: [
        base,
        '[1:v]trim=start=0.000:end=2.000,scale=w=500:h=500,crop=w=500:h=500:x=0:y=0[c0]',
        '[bg0][c0]overlay=x=100:y=200:eof_action=pass[bg1]',
        frames(1),
      ],
    },
    {
      name: 'a cropped placement shows only the crop',
      clips: [
        clip({
          source: { width: 1000, height: 1000 },
          placement: {
            x: 0,
            y: 0,
            width: 400,
            height: 400,
            rotation: 0,
            crop: { x: 500, y: 500, width: 200, height: 200 },
          },
        }),
      ],
      want: [
        base,
        '[1:v]trim=start=0.000:end=2.000,scale=w=2000:h=2000,crop=w=400:h=400:x=1000:y=1000[c0]',
        '[bg0][c0]overlay=x=0:y=0:eof_action=pass[bg1]',
        frames(1),
      ],
    },
    {
      name: 'a clip running past the end is cut at the end; one starting after it is left out',
      clips: [
        clip({ startMs: 14000, inMs: 0, outMs: 3000 }),
        clip({ startMs: 15000, inMs: 0, outMs: 3000 }),
      ],
      want: [
        base,
        `[1:v]trim=start=14.000:end=15.000,${coverFull}[c0]`,
        '[bg0][c0]overlay=x=0:y=0:eof_action=pass[bg1]',
        frames(1),
      ],
    },
    {
      name: 'a placement with no width is left out',
      clips: [clip({ placement: { x: 0, y: 0, width: 0, height: 100, rotation: 0, crop: null } })],
      want: [base, frames(0)],
    },
  ])('$name', ({ clips, want }) => {
    const text = graph(clips)
    expect(text).toBe(want.join(';'))
    expect(() => assertSafeGraph(text)).not.toThrow()
    expect(text).not.toMatch(/movie/)
  })

  it('uses the frame rate it is given', () => {
    expect(graph([], 2000, 60)).toContain('color=c=black:s=1080x1920:r=60:d=2.000[bg0]')
  })

  it('refuses a number that is not finite instead of writing it into the graph', () => {
    expect(() => graph([clip({ startMs: Number.NaN })])).toThrow()
    expect(() => filterGraph([], { width: Infinity, height: 1920 }, 1000, 30)).toThrow()
    expect(() => filterGraph([], { width: 1e30, height: 1920 }, 1000, 30)).toThrow()
  })
})

describe('assertSafeGraph [P8-15]', () => {
  it.each([
    ['movie=/etc/passwd[a]'],
    ['amovie=x.wav[a]'],
    ["drawtext=text='hi'"],
    ['scale=w=10:h=10 '],
    ['setpts=PTS-STARTPTS'],
    ['crop=w=1/2'],
    ['a\\b'],
    ['concat=n=2|x'],
  ])('refuses %s', (text) => {
    expect(() => assertSafeGraph(text)).toThrow()
  })
})
