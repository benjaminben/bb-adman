// spec/make-variants.md "Text that fits", "At creation": a new variant's plan, its brief copy,
// its scaled pixel measures, the font size its words fit at, and the override paths they give.
import { describe, expect, it } from 'vitest'
import { planNewVariant, type NewVariantInput } from '@/shared/links/new-variant-plan'
import { fittedFontSize, scaleTextMeasures } from '@/shared/links/fit-text'
import type { PlannedLayer } from '@/shared/links/fan-out-plan'
import { textLookOf } from '@/shared/config/look'
import { DEFAULT_STARTER_LAYOUT } from '@/shared/config/default-layout'
import { buildMasterLayers } from '@/shared/templates/master-layers'
import { starterTemplate } from '@/shared/templates/starter'
import type { Brief } from '@/shared/schemas/brief'
import type { Geometry, TextStyle } from '@/shared/schemas/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { SlotFills } from '@/shared/templates/types'

// Plain words of 8 letters and a space, cut to `n` letters (as in fit-text.test.ts).
const words = (n: number) => 'abcdefgh '.repeat(Math.ceil(n / 9)).slice(0, n)

const FILLS: SlotFills = {
  background: { assetId: 'asset-bg' },
  'subject-image': { assetId: 'asset-subject' },
  logo: { assetId: 'asset-logo' },
  headline: { text: 'Fresh for summer' },
  'call-to-action': { text: 'Shop now' },
}
const SQUARE = { width: 1080, height: 1080, language: 'en' }
const WIDE = { width: 1920, height: 1080, language: 'en' }
const SMALL = { width: 300, height: 250, language: 'en' }
const MEASURES = ['fontSize', 'boxPadding', 'boxRadius', 'boxOutlineWidth'] as const

const MASTER: LayerRow[] = buildMasterLayers(
  starterTemplate,
  { label: '1x1', width: 1080, height: 1080 },
  FILLS,
  DEFAULT_STARTER_LAYOUT,
).map((l) => ({ ...l, id: `m-${l.key}`, variantId: 'm' }))

const brief = { copy: { de: { headline: words(120) } } } as unknown as Brief
const CAMPAIGN = { primaryLanguage: 'en', brief }

const input = (over: Partial<NewVariantInput>): NewVariantInput => ({
  campaign: CAMPAIGN,
  master: SQUARE,
  masterLayers: MASTER,
  target: SQUARE,
  fit: 'scale',
  pictureSize: { width: 1600, height: 900 },
  ...over,
})

const named = (layers: Array<Pick<LayerRow, 'key'>>, key: string) =>
  layers.find((l) => l.key === key) as PlannedLayer
const styleOf = (layers: Array<Pick<LayerRow, 'key' | 'style'>>, key: string) =>
  named(layers as PlannedLayer[], key).style as TextStyle
const withoutMeasures = (style: TextStyle) => {
  const rest: Record<string, unknown> = { ...style }
  for (const m of MEASURES) delete rest[m]
  return rest
}
const texts = MASTER.filter((l) => l.type === 'text').map((l) => l.key)

const box = (x: number, y: number, width: number, height: number): Geometry => ({
  x,
  y,
  width,
  height,
  rotation: 0,
  crop: null,
})
const withTitle = (geometry: Geometry, copy: string): LayerRow[] =>
  MASTER.map((l) => (l.key === 'headline' ? { ...l, geometry, copy } : l))

describe('planNewVariant, text that fits at creation [MV-4]', () => {
  it('from the master in its language at 1920 × 1080: no override, sizes stay', () => {
    const planned = planNewVariant(input({ target: WIDE }))
    for (const key of texts) expect(styleOf(planned, key)).toEqual(styleOf(MASTER, key))
    for (const l of planned) expect(l.overrides).toEqual([])
  })

  it('a de variant at 1080 × 1080 with brief words of 120 letters gets 47 and the path', () => {
    const planned = planNewVariant(input({ target: { ...SQUARE, language: 'de' } }))
    const headline = named(planned, 'headline')
    expect(headline.copy).toBe(words(120))
    expect(headline.translationStatus).toBe('proposed')
    expect((headline.style as TextStyle).fontSize).toBe(47)
    expect(headline.overrides).toEqual(['style.fontSize'])
  })

  it('at 300 × 250 the measures are scaled and each one that differs is a path', () => {
    const planned = planNewVariant(input({ target: SMALL }))
    const k = 250 / 1080
    for (const key of texts) {
      const master = styleOf(MASTER, key)
      const scaled = scaleTextMeasures(master, k)
      const mine = styleOf(planned, key)
      expect(withoutMeasures(mine)).toEqual(withoutMeasures(master))
      expect([mine.boxPadding, mine.boxRadius, mine.boxOutlineWidth]).toEqual([
        scaled.boxPadding,
        scaled.boxRadius,
        scaled.boxOutlineWidth,
      ])
      expect(mine.fontSize).toBeLessThanOrEqual(scaled.fontSize)
      const differ = MEASURES.filter((m) => textLookOf(mine)[m] !== textLookOf(master)[m])
      expect(named(planned, key).overrides).toEqual(differ.map((m) => `style.${m}`))
      expect(differ).toContain('fontSize')
    }
  })

  it('a new size and language take the same-size plan boxes and fit their own words', () => {
    const sameSizePlan = planNewVariant(input({ target: WIDE }))
    const planned = planNewVariant(input({ target: { ...WIDE, language: 'de' }, sameSizePlan }))
    for (const l of planned) expect(l.geometry).toEqual(named(sameSizePlan, l.key).geometry)
    const headline = named(planned, 'headline')
    const expected = fittedFontSize(
      words(120),
      headline.geometry,
      styleOf(MASTER, 'headline'),
      WIDE,
    )
    expect((headline.style as TextStyle).fontSize).toBe(expected)
    expect(expected).toBeLessThan(81)
    expect(headline.overrides).toEqual(['style.fontSize'])
  })

  it('the same words in a box not tighter keep the size, even where the estimate is careful', () => {
    const tall = { width: 1080, height: 1920, language: 'en' }
    const master = withTitle(box(80, 640, 920, 260), words(1000))
    const planned = planNewVariant(input({ masterLayers: master, target: tall }))
    expect(named(planned, 'headline').geometry).toMatchObject({ width: 920, height: 260 })
    expect(styleOf(planned, 'headline').fontSize).toBe(81)
  })

  it('the same words in a narrower box are fitted', () => {
    const master = withTitle(box(110, 640, 1700, 260), words(60))
    const planned = planNewVariant(input({ master: WIDE, masterLayers: master, target: SQUARE }))
    const headline = named(planned, 'headline')
    expect(headline.geometry.width).toBeLessThan(1700)
    const expected = fittedFontSize(
      words(60),
      headline.geometry,
      styleOf(MASTER, 'headline'),
      SQUARE,
    )
    expect(expected).toBeLessThan(81)
    expect(styleOf(planned, 'headline').fontSize).toBe(expected)
  })

  it("a new variant in the source's size and language takes the source's style unchanged", () => {
    const own = { ...styleOf(MASTER, 'headline'), fontSize: 33, boxPadding: 5 }
    const source = MASTER.map((l) =>
      l.key === 'headline'
        ? { ...l, linked: true, copy: 'Kurz', style: own, overrides: ['style.fontSize'] }
        : { ...l, linked: true },
    )
    const de = { ...SQUARE, language: 'de' }
    const planned = planNewVariant(input({ target: de, source: { facts: de, layers: source } }))
    expect(styleOf(planned, 'headline')).toEqual(own)
    expect(named(planned, 'headline').copy).toBe('Kurz')
    expect(named(planned, 'headline').overrides).toEqual(['style.fontSize'])
  })
})
