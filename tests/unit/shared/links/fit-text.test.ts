import { describe, it, expect } from 'vitest'
import {
  fitTranslatedText,
  fittedFontSize,
  measureOverrides,
  scaleTextMeasures,
} from '@/shared/links/fit-text'
import { LOOK_LIMITS, type TextStyle } from '@/shared/schemas/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'

// Plain words of 8 letters and a space, cut to `n` letters; every n used ends on a letter.
const words = (n: number) => 'abcdefgh '.repeat(Math.ceil(n / 9)).slice(0, n)

// The headline style of layout 1 at 1080 × 1080 (spec/starter-layouts.md).
const HEADLINE: TextStyle = {
  fontAssetId: null,
  fontSize: 81,
  fontWeight: 700,
  color: '#FFFFFF',
  align: 'left',
  lineHeight: 1.1,
  letterSpacing: 0,
  verticalAlign: 'bottom',
  allCaps: false,
  boxColor: null,
  boxOutlineColor: null,
  boxOutlineWidth: 0,
  boxRadius: 0,
  boxPadding: 0,
}
const without = (style: TextStyle, keys: Array<keyof TextStyle>): TextStyle =>
  Object.fromEntries(
    Object.entries(style).filter(([k]) => !keys.includes(k as keyof TextStyle)),
  ) as TextStyle
const SQUARE = { width: 1080, height: 1080 }
const SMALL = { width: 300, height: 250 }
const BOX = { width: 950, height: 238 }
const TALL_BOX = { width: 950, height: 422 }

describe('fittedFontSize [spec/make-variants.md "Text that fits"]', () => {
  it.each([
    [60, 71],
    [120, 47],
  ])('words of %i letters in 950 × 238 at 1080 × 1080 give %i', (n, size) => {
    expect(fittedFontSize(words(n), BOX, HEADLINE, SQUARE)).toBe(size)
  })

  it('keeps the size for the same words in a box not tighter', () => {
    expect(fittedFontSize(words(11), BOX, HEADLINE, SQUARE)).toBe(81)
    expect(fittedFontSize(words(60), TALL_BOX, HEADLINE, SQUARE)).toBe(81)
  })

  it('is never larger than the start', () => {
    const style = { ...HEADLINE, fontSize: 40 }
    expect(fittedFontSize(words(11), TALL_BOX, style, SQUARE)).toBe(40)
    expect(fittedFontSize('', TALL_BOX, style, SQUARE)).toBe(40)
  })

  it('gives max(1, round(0.02 × S)) when nothing fits', () => {
    expect(fittedFontSize(words(1000), BOX, HEADLINE, SQUARE)).toBe(22)
    const small = { ...HEADLINE, fontSize: 19 }
    expect(fittedFontSize(words(1000), { width: 220, height: 55 }, small, SMALL)).toBe(5)
  })

  it('never gives more than the start, even when nothing fits', () => {
    const style = { ...HEADLINE, fontSize: 15 }
    expect(fittedFontSize(words(1000), BOX, style, SQUARE)).toBe(15)
  })

  it('takes padding, outline, capitals and spacing from the style', () => {
    const button: TextStyle = {
      ...HEADLINE,
      fontSize: 38,
      lineHeight: 1.2,
      letterSpacing: 0.02,
      boxPadding: 16,
      boxOutlineWidth: 3,
    }
    const box = { width: 454, height: 97 }
    expect(fittedFontSize('Shop now', box, button, SQUARE)).toBe(38)
    expect(fittedFontSize(words(40), box, button, SQUARE)).toBe(24)
  })
})

describe('scaleTextMeasures [spec/make-variants.md "At creation"]', () => {
  const MEASURED = { ...HEADLINE, fontSize: 81, boxPadding: 16, boxRadius: 0, boxOutlineWidth: 3 }

  it('turns 81, 16, 0, 3 into 19, 4, 0, 1 at k = 250/1080', () => {
    const s = scaleTextMeasures(MEASURED, 250 / 1080)
    expect([s.fontSize, s.boxPadding, s.boxRadius, s.boxOutlineWidth]).toEqual([19, 4, 0, 1])
  })

  it('changes nothing at k = 1', () => {
    expect(scaleTextMeasures(MEASURED, 1)).toEqual(MEASURED)
    const odd = { ...MEASURED, fontSize: 80.5 }
    expect(scaleTextMeasures(odd, 1)).toEqual(odd)
  })

  it('keeps the rest of the style', () => {
    const s = scaleTextMeasures(MEASURED, 0.5)
    expect({ ...s, fontSize: 0, boxPadding: 0, boxRadius: 0, boxOutlineWidth: 0 }).toEqual({
      ...MEASURED,
      fontSize: 0,
      boxPadding: 0,
      boxRadius: 0,
      boxOutlineWidth: 0,
    })
  })

  it('keeps fontSize at least 1, and an outline at least 1 when there was one', () => {
    const s = scaleTextMeasures({ ...MEASURED, fontSize: 2, boxOutlineWidth: 1 }, 0.1)
    expect([s.fontSize, s.boxOutlineWidth]).toEqual([1, 1])
    expect(scaleTextMeasures({ ...MEASURED, boxOutlineWidth: 0 }, 0.1).boxOutlineWidth).toBe(0)
  })

  it('keeps look fields inside LOOK_LIMITS', () => {
    const big = { ...MEASURED, boxPadding: 300, boxRadius: 500, boxOutlineWidth: 50 }
    const s = scaleTextMeasures(big, 10)
    expect(s.boxPadding).toBe(LOOK_LIMITS.boxPadding.max)
    expect(s.boxRadius).toBe(LOOK_LIMITS.boxRadius.max)
    expect(s.boxOutlineWidth).toBe(LOOK_LIMITS.boxOutlineWidth.max)
  })

  it('leaves an absent look field absent', () => {
    const bare = without(MEASURED, ['boxPadding', 'boxRadius', 'boxOutlineWidth'])
    const s = scaleTextMeasures(bare, 0.5)
    expect('boxPadding' in s || 'boxRadius' in s || 'boxOutlineWidth' in s).toBe(false)
    expect(s.fontSize).toBe(41)
  })
})

const layer = (style: TextStyle, change: Partial<LayerRow> = {}): LayerRow => ({
  id: 'L1',
  variantId: 'V2',
  key: 'headline',
  type: 'text',
  slot: 'headline',
  name: 'Headline',
  z: 3,
  visible: true,
  locked: false,
  linked: true,
  overrides: [],
  copy: 'Fresh for summer',
  style,
  geometry: { x: 65, y: 670, ...BOX, rotation: 0, crop: null },
  source: null,
  timing: { startMs: 0, endMs: null },
  animation: {
    entrance: { preset: 'none', startMs: 0, durationMs: 0 },
    exit: { preset: 'none', startMs: 0, durationMs: 0 },
  },
  revs: { copy: 0, style: 0, geometry: 0, source: 0, timing: 0, animation: 0 },
  syncedRevs: { copy: 0, style: 0, geometry: 0, source: 0, timing: 0, animation: 0 },
  translationStatus: 'missing',
  translationSource: null,
  overflow: false,
  ...change,
})
const MASTER = { style: HEADLINE }

describe('fitTranslatedText [spec/make-variants.md "When a translation arrives"]', () => {
  it('shrinks for longer words and records style.fontSize', () => {
    const fit = fitTranslatedText(layer(HEADLINE), words(120), SQUARE, MASTER)
    expect(fit?.style).toEqual({ ...HEADLINE, fontSize: 47 })
    expect(fit?.overrides).toEqual(['style.fontSize'])
  })

  it('gives null for shorter words', () => {
    expect(fitTranslatedText(layer(HEADLINE), words(11), SQUARE, MASTER)).toBeNull()
  })

  it('starts from the current size and only goes smaller', () => {
    const current = { ...HEADLINE, fontSize: 50 }
    expect(fitTranslatedText(layer(current), words(60), SQUARE, MASTER)).toBeNull()
    expect(fitTranslatedText(layer(current), words(120), SQUARE, MASTER)?.style.fontSize).toBe(47)
  })

  it('adds no path on an unlinked layer', () => {
    const fit = fitTranslatedText(layer(HEADLINE, { linked: false }), words(120), SQUARE, null)
    expect(fit?.style.fontSize).toBe(47)
    expect(fit?.overrides).toEqual([])
  })
})

describe('measureOverrides [spec/make-variants.md "What a fitted size is to the link"]', () => {
  const measured = { ...HEADLINE, fontSize: 19, boxPadding: 4, boxOutlineWidth: 1 }

  it('adds a path for each measure whose value differs from the master layer', () => {
    expect(measureOverrides(layer(measured), MASTER)).toEqual([
      'style.fontSize',
      'style.boxPadding',
      'style.boxOutlineWidth',
    ])
  })

  it('adds nothing when every measure equals the master', () => {
    expect(measureOverrides(layer(HEADLINE, { overrides: ['copy'] }), MASTER)).toEqual(['copy'])
  })

  it('counts an absent look field as its default', () => {
    const bare = without(HEADLINE, ['boxPadding'])
    expect(measureOverrides(layer(bare), MASTER)).toEqual([])
  })

  it('keeps the paths already there first and adds each once', () => {
    const had = ['geometry', 'style.boxPadding']
    expect(measureOverrides(layer(measured, { overrides: had }), MASTER)).toEqual([
      'geometry',
      'style.boxPadding',
      'style.fontSize',
      'style.boxOutlineWidth',
    ])
  })

  it('adds nothing on an unlinked layer or with no master layer', () => {
    expect(measureOverrides(layer(measured, { linked: false }), MASTER)).toEqual([])
    expect(measureOverrides(layer(measured, { overrides: ['copy'] }), null)).toEqual(['copy'])
  })
})
