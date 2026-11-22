// T3f (spec/phases/design-wave.md; spec/app-style.md "Icon rules (design wave)"): the 29 icons
// the design wave adds, each drawn for this app on the 24 by 24 grid.
import { describe, expect, it } from 'vitest'
import { ICON_NAMES } from '@/renderer/ui/icon'

const NEW_NAMES = [
  'alignLeft',
  'alignCentre',
  'alignRight',
  'alignTop',
  'alignMiddle',
  'alignBottom',
  'crop',
  'reset',
  'scissors',
  'fit',
  'fill',
  'shadeNone',
  'shadeBottom',
  'shadeTop',
  'shadeLeft',
  'shadeRight',
  'shadeAll',
  'allCaps',
  'lineHeight',
  'letterSpacing',
  'radius',
  'padding',
  'speaker',
  'speakerOff',
  'pin',
  'pencil',
  'xCircle',
  'coin',
  'stop',
]

describe('Icon names [T3f]', () => {
  it('lists 29 new names', () => {
    expect(new Set(NEW_NAMES).size).toBe(29)
  })

  it.each(NEW_NAMES.map((name) => [name]))('%s is in ICON_NAMES', (name) => {
    expect(ICON_NAMES).toContain(name)
  })
})
