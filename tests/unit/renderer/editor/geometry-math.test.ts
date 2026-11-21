// spec/editor.md, "Selecting" and "Moving, resizing and rotating": the pure geometry of the
// canvas. Hit testing of turned boxes is in pick-layer.test.ts.
import { describe, expect, it } from 'vitest'
import {
  boundsOf,
  foldAngle,
  moveBox,
  resizeBox,
  turnBox,
  type Box,
  type Handle,
} from '@/renderer/editor/geometry-math'

const box: Box = { x: 100, y: 100, width: 200, height: 100, rotation: 0 }

function near(actual: Box, expected: Box) {
  for (const key of ['x', 'y', 'width', 'height', 'rotation'] as const) {
    expect(actual[key], key).toBeCloseTo(expected[key], 6)
  }
}

describe('boundsOf [spec/editor.md "Snapping and guides"]', () => {
  it.each([
    ['a plain box is its own bounds', box, { left: 100, top: 100, right: 300, bottom: 200 }],
    [
      'a box turned 90° stands upright about its centre',
      { ...box, rotation: 90 },
      { left: 150, top: 50, right: 250, bottom: 250 },
    ],
    [
      'a square turned 45° spreads by the diagonal',
      { x: 0, y: 0, width: 100, height: 100, rotation: 45 },
      {
        left: 50 - 50 * Math.SQRT2,
        top: 50 - 50 * Math.SQRT2,
        right: 50 + 50 * Math.SQRT2,
        bottom: 50 + 50 * Math.SQRT2,
      },
    ],
  ])('%s', (_case, b, expected) => {
    const got = boundsOf(b)
    for (const key of ['left', 'top', 'right', 'bottom'] as const) {
      expect(got[key], key).toBeCloseTo(expected[key], 6)
    }
  })
})

describe('moveBox', () => {
  it('adds the offset and keeps size and angle', () => {
    expect(moveBox({ ...box, rotation: 30 }, { x: 5, y: -7 })).toEqual({
      ...box,
      x: 105,
      y: 93,
      rotation: 30,
    })
  })
})

describe('resizeBox [spec/editor.md "Moving, resizing and rotating"]', () => {
  const cases: [string, Box, Handle, { x: number; y: number }, boolean, Box][] = [
    ['right side grows; left stays', box, 'e', { x: 50, y: 30 }, false, { ...box, width: 250 }],
    [
      'left side grows; right stays',
      box,
      'w',
      { x: -50, y: 0 },
      false,
      { ...box, x: 50, width: 250 },
    ],
    [
      'top side shrinks; bottom stays',
      box,
      'n',
      { x: 0, y: 40 },
      false,
      { ...box, y: 140, height: 60 },
    ],
    [
      'bottom-right corner; top-left stays',
      box,
      'se',
      { x: 20, y: 10 },
      false,
      { ...box, width: 220, height: 110 },
    ],
    [
      'top-left corner; bottom-right stays',
      box,
      'nw',
      { x: -20, y: -10 },
      false,
      { ...box, x: 80, y: 90, width: 220, height: 110 },
    ],
    [
      'width stays at least 1 when dragged past the other side',
      box,
      'e',
      { x: -500, y: 0 },
      false,
      { ...box, width: 1 },
    ],
    [
      'height stays at least 1, and the opposite side stays put',
      box,
      'n',
      { x: 0, y: 500 },
      false,
      { ...box, y: 199, height: 1 },
    ],
    [
      'along the turned side: a box turned 90° grows its width downward',
      { ...box, rotation: 90 },
      'e',
      { x: 0, y: 40 },
      false,
      // Width 240; the left side (now on top, at y 50) stays put, so the centre goes down 20.
      { x: 80, y: 120, width: 240, height: 100, rotation: 90 },
    ],
    [
      'a turned box ignores the pointer across its side',
      { ...box, rotation: 90 },
      'e',
      { x: 70, y: 0 },
      false,
      { ...box, rotation: 90 },
    ],
    [
      'Shift keeps the shape at a corner, led by the larger change',
      box,
      'se',
      { x: 100, y: 0 },
      true,
      { ...box, width: 300, height: 150 },
    ],
    [
      'Shift keeps the shape at a side, growing about the middle of the other axis',
      box,
      'e',
      { x: 200, y: 0 },
      true,
      { ...box, y: 50, width: 400, height: 200 },
    ],
  ]
  it.each(cases)('%s', (_case, start, handle, delta, keepShape, expected) => {
    near(resizeBox(start, handle, delta, keepShape), expected)
  })
})

describe('foldAngle: stored in (−180, 180]', () => {
  it.each([
    [0, 0],
    [180, 180],
    [-180, 180],
    [190, -170],
    [-190, 170],
    [360, 0],
    [725, 5],
  ])('%d° folds to %d°', (angle, folded) => {
    expect(foldAngle(angle)).toBe(folded)
  })
})

describe('turnBox: the angle measured from the box centre', () => {
  const centre = { x: 200, y: 150 }
  it.each([
    ['a quarter turn clockwise', 0, { x: 200, y: 50 }, { x: 300, y: 150 }, false, 90],
    ['adds to the start angle', 30, { x: 200, y: 50 }, { x: 300, y: 150 }, false, 120],
    ['folds past 180', 170, { x: 200, y: 50 }, { x: 300, y: 150 }, false, -100],
    ['a small turn without Shift', 0, { x: 200, y: 50 }, { x: 210, y: 50 }, false, 5.710593],
    ['Shift steps by 15°: 5.7° rounds to 0', 0, { x: 200, y: 50 }, { x: 210, y: 50 }, true, 0],
    [
      'Shift steps by 15°: 40° rounds to 45',
      0,
      { x: 200, y: 50 },
      { x: 200 + 100 * Math.sin(0.698), y: 150 - 100 * Math.cos(0.698) },
      true,
      45,
    ],
    [
      'Shift steps the stored angle, not the turn',
      7,
      { x: 200, y: 50 },
      { x: 300, y: 150 },
      true,
      90,
    ],
  ])('%s', (_case, start, from, to, step, expected) => {
    expect(turnBox(start, centre, from, to, step)).toBeCloseTo(expected, 4)
  })
})
