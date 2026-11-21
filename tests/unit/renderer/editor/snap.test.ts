// spec/editor.md, "Snapping and guides" [FR-096]: the canvas edges and centre and every other
// visible layer's bounds are the lines; 6 screen pixels snap; the nearest line wins per axis;
// a resize snaps only the edges that move.
import { describe, expect, it } from 'vitest'
import type { Bounds } from '@/renderer/editor/geometry-math'
import { snapLines, snapMove, snapResize, type Lines } from '@/renderer/editor/snap'

const lines: Lines = { x: [0, 540, 1080, 250, 300, 350], y: [0, 675, 1350] }

// A 100 by 50 box with its top-left corner at (x, y).
const at = (x: number, y: number): Bounds => ({ left: x, top: y, right: x + 100, bottom: y + 50 })

describe('snapLines', () => {
  it('holds the canvas edges and centre, then each other box’s edges and centre', () => {
    const others = [
      { x: 100, y: 10, width: 200, height: 40, rotation: 0 },
      { x: 0, y: 0, width: 100, height: 100, rotation: 90 },
    ]
    expect(snapLines({ width: 1080, height: 1350 }, others)).toEqual({
      x: [0, 540, 1080, 100, 200, 300, 0, 50, 100],
      y: [0, 675, 1350, 10, 30, 50, 0, 50, 100],
    })
  })
})

describe('snapMove [FR-096]', () => {
  it.each([
    ['the left edge to the canvas left at 100%', at(5, 400), 1, { x: -5, y: 0 }, { x: 0, y: null }],
    ['not at 7 screen px at 100%', at(7, 400), 1, { x: 0, y: 0 }, { x: null, y: null }],
    ['the centre to the canvas centre', at(493, 400), 1, { x: -3, y: 0 }, { x: 540, y: null }],
    ['the right edge to the canvas right', at(984, 400), 1, { x: -4, y: 0 }, { x: 1080, y: null }],
    ['the bottom to the canvas foot', at(400, 1302), 1, { x: 0, y: -2 }, { x: null, y: 1350 }],
    ['the centre to the canvas middle', at(400, 652), 1, { x: 0, y: -2 }, { x: null, y: 675 }],
    ['another layer’s edge', at(353, 400), 1, { x: -3, y: 0 }, { x: 350, y: null }],
    ['12 variant px at 50% (6 screen px)', at(12, 400), 0.5, { x: -12, y: 0 }, { x: 0, y: null }],
    ['not 13 variant px at 50%', at(13, 400), 0.5, { x: 0, y: 0 }, { x: null, y: null }],
    ['not 4 variant px at 200% (8 screen px)', at(4, 400), 2, { x: 0, y: 0 }, { x: null, y: null }],
    ['3 variant px at 200% (6 screen px)', at(3, 400), 2, { x: -3, y: 0 }, { x: 0, y: null }],
    [
      'the nearest line wins: right edge 1 px off 350, centre 1.5 off 300, left 2 off 250',
      { left: 252, top: 400, right: 351, bottom: 450 },
      1,
      { x: -1, y: 0 },
      { x: 350, y: null },
    ],
    ['each axis on its own', at(-4, 1298), 1, { x: 4, y: 2 }, { x: 0, y: 1350 }],
  ])('snaps %s', (_case, bounds, zoom, offset, guides) => {
    expect(snapMove(bounds, lines, zoom)).toEqual({ offset, guides })
  })
})

describe('snapResize: only the moving edges snap', () => {
  const box = (left: number, top: number, right: number, bottom: number) => ({
    left,
    top,
    right,
    bottom,
  })
  it.each([
    [
      'the right edge, pulled right',
      { x: 1, y: 0 },
      box(400, 400, 537, 450),
      box(400, 400, 540, 450),
      { x: 540, y: null },
    ],
    [
      'not the left edge when the right one moves',
      { x: 1, y: 0 },
      box(2, 400, 450, 450),
      box(2, 400, 450, 450),
      { x: null, y: null },
    ],
    [
      'the left and top edges at the top-left corner',
      { x: -1, y: -1 },
      box(253, 3, 450, 450),
      box(250, 0, 450, 450),
      { x: 250, y: 0 },
    ],
    [
      'nothing on the axis a side handle does not pull',
      { x: 1, y: 0 },
      box(400, 2, 500, 1349),
      box(400, 2, 500, 1349),
      { x: null, y: null },
    ],
  ])('%s', (_case, pull, input, bounds, guides) => {
    expect(snapResize(input, pull, lines, 1)).toEqual({ bounds, guides })
  })
})
