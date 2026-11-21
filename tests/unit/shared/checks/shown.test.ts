import { describe, expect, it } from 'vitest'
import { isShown } from '@/shared/checks/shown'
import type { CheckInput } from '@/shared/checks/types'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { input, layer, picture, text } from './fixtures'

const image = input().variant
const video: CheckInput['variant'] = { ...image, format: 'video', durationMs: 6000 }

describe('the shown rule (A-150, A-151)', () => {
  it.each<[string, LayerRow, CheckInput['variant'], boolean]>([
    ['a visible picture on the canvas', picture('p', 'a1'), image, true],
    ['a hidden picture', picture('p', 'a1', { visible: false }), image, false],
    ['a picture at opacity 0', picture('p', 'a1', { style: { opacity: 0 } }), image, false],
    [
      'a background at opacity 0',
      layer('b', 'background', { style: { opacity: 0 } }),
      image,
      false,
    ],
    ['a picture off the right edge', picture('p', 'a1', { geometry: { x: 1000 } }), image, false],
    ['a picture off the top edge', picture('p', 'a1', { geometry: { y: -100 } }), image, false],
    ['a picture of zero width', picture('p', 'a1', { geometry: { width: 0 } }), image, false],
    [
      'a picture rotated into the canvas',
      picture('p', 'a1', { geometry: { x: 300, y: -200, width: 400, height: 20, rotation: 90 } }),
      image,
      true,
    ],
    [
      'a picture whose rotation keeps it outside',
      picture('p', 'a1', { geometry: { x: 300, y: -250, width: 400, height: 20, rotation: 90 } }),
      image,
      false,
    ],
    ['a text layer with copy', text('t', 'Vexlo'), image, true],
    ['a text layer with blank copy', text('t', '   '), image, false],
    ['a text layer with no copy', text('t', null), image, false],
    [
      'a video layer inside the duration',
      picture('p', 'a1', { timing: { startMs: 1000, endMs: 2000 } }),
      video,
      true,
    ],
    [
      'a video layer that starts at the end',
      picture('p', 'a1', { timing: { startMs: 6000, endMs: null } }),
      video,
      false,
    ],
    [
      'a video layer that ends before the start',
      picture('p', 'a1', { timing: { startMs: -500, endMs: 0 } }),
      video,
      false,
    ],
    [
      'timing is ignored for an image',
      picture('p', 'a1', { timing: { startMs: 9000, endMs: null } }),
      image,
      true,
    ],
  ])('%s', (_label, row, variant, expected) => {
    expect(isShown(row, variant)).toBe(expected)
  })
})
