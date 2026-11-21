// spec/editor.md, "Selecting": the topmost visible, unlocked layer whose turned box holds the
// point; else the background.
import { describe, expect, it } from 'vitest'
import { boxHolds, pickLayer } from '@/renderer/editor/geometry-math'
import { BACKGROUND, HEADLINE, LOGO } from './editor-fixture'

const box = { x: 0, y: 0, width: 200, height: 20, rotation: 0 }

describe('pickLayer [spec/editor.md "Selecting"]', () => {
  it.each([
    ['inside a plain box', box, { x: 150, y: 10 }, true],
    ['outside a plain box', box, { x: 150, y: 30 }, false],
    [
      'inside a box turned 90°, where the plain box would not be',
      { ...box, rotation: 90 },
      { x: 100, y: 80 },
      true,
    ],
    [
      'outside a box turned 90°, where the plain box would be',
      { ...box, rotation: 90 },
      { x: 180, y: 10 },
      false,
    ],
  ])('boxHolds: %s', (_case, b, point, held) => {
    expect(boxHolds(b, point)).toBe(held)
  })

  it.each([
    ['the topmost layer holding the point', [BACKGROUND, HEADLINE, LOGO], { x: 500, y: 200 }, 'L1'],
    [
      'the higher of two overlapping layers',
      [BACKGROUND, HEADLINE, { ...LOGO, geometry: HEADLINE.geometry }],
      { x: 500, y: 200 },
      'L2',
    ],
    [
      'the background when nothing above holds the point',
      [BACKGROUND, HEADLINE],
      { x: 20, y: 900 },
      'L0',
    ],
    [
      'past a hidden layer',
      [BACKGROUND, { ...HEADLINE, visible: false }],
      { x: 500, y: 200 },
      'L0',
    ],
    ['past a locked layer', [BACKGROUND, { ...HEADLINE, locked: true }], { x: 500, y: 200 }, 'L0'],
    [
      'nothing when the background is locked',
      [{ ...BACKGROUND, locked: true }],
      { x: 20, y: 20 },
      null,
    ],
  ])('picks %s', (_case, layers, point, id) => {
    expect(pickLayer(layers, point)).toBe(id)
  })
})
