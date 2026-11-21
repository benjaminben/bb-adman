// LK-1: textLookOf and pictureLookOf are the one owner of the look defaults
// (spec/data-model-campaign.md "Look fields"). Absent means the default; present is kept.
import { describe, it, expect } from 'vitest'
import {
  NEW_SHADE,
  PICTURE_LOOK_DEFAULTS,
  TEXT_LOOK_DEFAULTS,
  pictureLookOf,
  textLookOf,
} from '@/shared/config/look'
import { Shade, type ImageStyle, type TextStyle } from '@/shared/schemas/layer'

const TEXT: TextStyle = {
  fontAssetId: null,
  fontSize: 40,
  fontWeight: 700,
  color: '#FFFFFF',
  align: 'left',
  lineHeight: 1.2,
  letterSpacing: 0,
}
const SHADE = { color: '#112233', from: 'top', strength: 0.4, reach: 0.5 } as const

describe('the look defaults [LK-1, A-71]', () => {
  it('are the defaults of the spec, which draw as before', () => {
    expect(TEXT_LOOK_DEFAULTS).toEqual({
      verticalAlign: 'top',
      allCaps: false,
      boxColor: null,
      boxOutlineColor: null,
      boxOutlineWidth: 0,
      boxRadius: 0,
      boxPadding: 0,
    })
    expect(PICTURE_LOOK_DEFAULTS).toEqual({ fillColor: null, shade: null })
  })

  it('NEW_SHADE is a valid shade', () => {
    expect(Shade.safeParse(NEW_SHADE).success).toBe(true)
  })
})

describe('textLookOf [LK-1]', () => {
  it('fills every absent field with its default and keeps the rest', () => {
    expect(textLookOf(TEXT)).toEqual({ ...TEXT, ...TEXT_LOOK_DEFAULTS })
  })

  it.each<[keyof typeof TEXT_LOOK_DEFAULTS, unknown]>([
    ['verticalAlign', 'bottom'],
    ['allCaps', true],
    ['boxColor', '#1A2B3C'],
    ['boxOutlineColor', '#ABCDEF'],
    ['boxOutlineWidth', 4],
    ['boxRadius', 12],
    ['boxPadding', 30],
  ])('keeps a present %s', (field, value) => {
    const look = textLookOf({ ...TEXT, [field]: value })
    expect(look[field]).toBe(value)
    expect(look).toEqual({ ...TEXT, ...TEXT_LOOK_DEFAULTS, [field]: value })
  })
})

describe('pictureLookOf [LK-1]', () => {
  it('fills every absent field with its default and keeps the opacity', () => {
    const style: ImageStyle = { opacity: 0.5 }
    expect(pictureLookOf(style)).toEqual({ opacity: 0.5, fillColor: null, shade: null })
  })

  it('keeps a present fillColor and shade', () => {
    expect(pictureLookOf({ opacity: 1, fillColor: '#FFD54A' })).toEqual({
      opacity: 1,
      fillColor: '#FFD54A',
      shade: null,
    })
    expect(pictureLookOf({ opacity: 1, shade: SHADE })).toEqual({
      opacity: 1,
      fillColor: null,
      shade: SHADE,
    })
  })
})
