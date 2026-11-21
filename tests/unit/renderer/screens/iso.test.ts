// ST-6: the grid-to-page maths of the start page drawings, as in the prototype
// (design/prototype/js/illustrations.js): a 9-unit step, x and y on the ground, z up.
import { describe, expect, it } from 'vitest'
import {
  boxFaces,
  glyphMatrix,
  linePoints,
  pt,
  stairs,
  topFace,
} from '@/renderer/screens/start/start-drawings/iso'

describe('iso maths [ST-6]', () => {
  it.each([
    [
      [1, 0, 0],
      [7.8, 4.5],
    ],
    [
      [0, 1, 0],
      [-7.8, 4.5],
    ],
    [
      [0, 0, 1],
      [0, -9],
    ],
    [
      [2, 2, 0],
      [0, 18],
    ],
  ] as const)('maps grid point %j to page point %j', ([x, y, z], expected) => {
    expect(pt(x, y, z)).toEqual(expected)
  })

  it('leaves out z for a ground point', () => {
    expect(pt(1, 0)).toEqual([7.8, 4.5])
  })

  it('writes a flat top as four page points', () => {
    expect(topFace(0, 0, 1, 1, 0)).toBe('0.0,0.0 7.8,4.5 0.0,9.0 -7.8,4.5')
  })

  it('draws a box as its left, right and top faces', () => {
    const faces = boxFaces(0, 0, 1, 1, 0, 1)
    expect(faces.top).toBe('0.0,-9.0 7.8,-4.5 0.0,0.0 -7.8,-4.5')
    expect(faces.left).toBe('-7.8,-4.5 0.0,0.0 0.0,9.0 -7.8,4.5')
    expect(faces.right).toBe('7.8,-4.5 0.0,0.0 0.0,9.0 7.8,4.5')
  })

  it('writes a line through grid points', () => {
    expect(
      linePoints([
        [0, 0, 1],
        [0, 0, 0],
      ]),
    ).toBe('0.0,-9.0 0.0,0.0')
  })

  it('climbs stairs in even steps, rising before each tread', () => {
    expect(stairs([0, 0, 0], [2, 0, 2], 2)).toEqual([
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [2, 0, 1],
      [2, 0, 2],
    ])
  })

  it('lays a flat mark on a top face with one matrix', () => {
    expect(glyphMatrix(0, 0, 0)).toBe('matrix(7.79 4.5 -7.79 4.5 0.0 0.0)')
  })
})
