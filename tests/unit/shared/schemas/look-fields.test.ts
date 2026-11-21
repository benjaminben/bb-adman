// LK-1 (security class): the look fields of TextStyle and ImageStyle. Every field is optional
// and bounded, with no .default(), because an outside agent can send them through layer.update
// (spec/data-model-campaign.md "Look fields"; spec/editor-commands.md "layer.update").
import { describe, it, expect } from 'vitest'
import {
  ImageStyle,
  LOOK_LIMITS,
  SHADE_SIDES,
  Shade,
  TextStyle,
  VERTICAL_ALIGNS,
} from '@/shared/schemas/layer'

const TEXT = {
  fontAssetId: null,
  fontSize: 40,
  fontWeight: 700,
  color: '#FFFFFF',
  align: 'left',
  lineHeight: 1.2,
  letterSpacing: 0,
}
const PICTURE = { opacity: 1 }
const SHADE = { color: '#000000', from: 'bottom', strength: 0.7, reach: 0.6 }

const text = (fields: Record<string, unknown>) =>
  TextStyle.safeParse({ ...TEXT, ...fields }).success
const picture = (fields: Record<string, unknown>) =>
  ImageStyle.safeParse({ ...PICTURE, ...fields }).success
const shade = (fields: Record<string, unknown>) => picture({ shade: { ...SHADE, ...fields } })

describe('the fixed lists and limits [LK-1]', () => {
  it('names the sides, the aligns and the bounds of the spec', () => {
    expect(SHADE_SIDES).toEqual(['bottom', 'top', 'left', 'right', 'all'])
    expect(VERTICAL_ALIGNS).toEqual(['top', 'middle', 'bottom'])
    expect(LOOK_LIMITS).toEqual({
      boxOutlineWidth: { min: 0, max: 100 },
      boxRadius: { min: 0, max: 2000 },
      boxPadding: { min: 0, max: 2000 },
      shadeStrength: { min: 0, max: 1 },
      shadeReach: { min: 0.05, max: 1 },
    })
  })
})

describe('TextStyle look fields [LK-1]', () => {
  it.each<[string, Record<string, unknown>, boolean]>([
    ['verticalAlign top', { verticalAlign: 'top' }, true],
    ['verticalAlign middle', { verticalAlign: 'middle' }, true],
    ['verticalAlign bottom', { verticalAlign: 'bottom' }, true],
    ['verticalAlign unknown', { verticalAlign: 'center' }, false],
    ['allCaps true', { allCaps: true }, true],
    ['allCaps not a boolean', { allCaps: 'yes' }, false],
    ['boxColor', { boxColor: '#1A2B3C' }, true],
    ['boxColor null', { boxColor: null }, true],
    ['boxColor short hex', { boxColor: '#FFF' }, false],
    ['boxColor css text', { boxColor: 'red; background: url(x)' }, false],
    ['boxOutlineColor', { boxOutlineColor: '#abcdef' }, true],
    ['boxOutlineColor null', { boxOutlineColor: null }, true],
    ['boxOutlineColor bad', { boxOutlineColor: '#12345G' }, false],
    ['boxOutlineWidth 0', { boxOutlineWidth: 0 }, true],
    ['boxOutlineWidth 100', { boxOutlineWidth: 100 }, true],
    ['boxOutlineWidth below', { boxOutlineWidth: -0.1 }, false],
    ['boxOutlineWidth above', { boxOutlineWidth: 100.1 }, false],
    ['boxRadius 0', { boxRadius: 0 }, true],
    ['boxRadius 2000', { boxRadius: 2000 }, true],
    ['boxRadius below', { boxRadius: -1 }, false],
    ['boxRadius above', { boxRadius: 2001 }, false],
    ['boxPadding 0', { boxPadding: 0 }, true],
    ['boxPadding 2000', { boxPadding: 2000 }, true],
    ['boxPadding below', { boxPadding: -1 }, false],
    ['boxPadding above', { boxPadding: 2001 }, false],
    ['boxPadding infinite', { boxPadding: Infinity }, false],
    ['boxPadding not a number', { boxPadding: NaN }, false],
    ['boxColor the word null', { boxColor: 'null' }, false],
  ])('%s', (_, fields, ok) => {
    expect(text(fields)).toBe(ok)
  })
})

describe('ImageStyle look fields [LK-1]', () => {
  it.each<[string, Record<string, unknown>, boolean]>([
    ['fillColor', { fillColor: '#FFD54A' }, true],
    ['fillColor null', { fillColor: null }, true],
    ['fillColor bad', { fillColor: 'url(x)' }, false],
    ['shade', { shade: SHADE }, true],
    ['shade null', { shade: null }, true],
    ['shade with an unknown key', { shade: { ...SHADE, blur: 3 } }, false],
    ['shade missing a key', { shade: { color: '#000000', from: 'top', strength: 1 } }, false],
  ])('%s', (_, fields, ok) => {
    expect(picture(fields)).toBe(ok)
  })

  it.each<[string, Record<string, unknown>, boolean]>([
    ...SHADE_SIDES.map((from): [string, Record<string, unknown>, boolean] => [
      from,
      { from },
      true,
    ]),
    ['unknown side', { from: 'middle' }, false],
    ['bad colour', { color: '#FFF' }, false],
    ['null colour', { color: null }, false],
    ['strength 0', { strength: 0 }, true],
    ['strength 1', { strength: 1 }, true],
    ['strength below', { strength: -0.01 }, false],
    ['strength above', { strength: 1.01 }, false],
    ['reach 0.05', { reach: 0.05 }, true],
    ['reach 1', { reach: 1 }, true],
    ['reach below', { reach: 0.04 }, false],
    ['reach above', { reach: 1.01 }, false],
    ['reach infinite', { reach: Infinity }, false],
  ])('shade %s', (_, fields, ok) => {
    expect(shade(fields)).toBe(ok)
  })

  it('exports Shade as a strict object', () => {
    expect(Shade.safeParse(SHADE).success).toBe(true)
    expect(Shade.safeParse({ ...SHADE, extra: 1 }).success).toBe(false)
  })
})

describe('stored styles and patches [LK-1, A-71]', () => {
  it('reads a stored text style and picture style without the fields, adding none', () => {
    expect(TextStyle.parse(TEXT)).toEqual(TEXT)
    expect(ImageStyle.parse(PICTURE)).toEqual(PICTURE)
  })

  it('fills no default inside a patch: partial() parses {} to {} (the Zod 4 guard)', () => {
    expect(TextStyle.partial().parse({})).toEqual({})
    expect(ImageStyle.partial().parse({})).toEqual({})
    expect(TextStyle.partial().strict().parse({ boxColor: null })).toEqual({ boxColor: null })
  })
})
