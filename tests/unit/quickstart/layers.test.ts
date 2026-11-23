import { describe, expect, it } from 'vitest'
import {
  MASTER_ASSET,
  fillPlacement,
  masterLayers,
  missingItems,
  planVariants,
  withFill,
  withLayout,
  withTranslations,
} from '../../../quickstart/layers'
import { readPlan } from '../../../quickstart/plan'

const BRIEF = `
campaignName: Garden Party
region: France
audience: People who like gardens
message: Grow something
callToAction: Start today
subjects:
  - name: Watering can
languages: [en, fr, de]
sizes: ['1:1', '9:16']
copy:
  fr:
    headline: Faites pousser
    callToAction: Commencer
`

function plan() {
  const result = readPlan(BRIEF, 'yaml')
  if (!result.ok) throw new Error(result.message)
  return result.plan
}

const PICTURE = { width: 1024, height: 1024 }
const variantsOf = () => planVariants(plan(), masterLayers(plan()), PICTURE)
const textOf = (layers: Array<{ key: string; copy: string | null }>, key: string) =>
  layers.find((layer) => layer.key === key)?.copy

describe('quickstart layers', () => {
  it("builds the master from the starter layout with the brief's words", () => {
    const layers = masterLayers(plan())
    expect(layers.map((l) => [l.key, l.type, l.z])).toEqual([
      ['background', 'background', 0],
      ['headline', 'text', 1],
      ['call-to-action', 'text', 2],
    ])
    expect(layers[0]?.source).toEqual({ assetId: MASTER_ASSET })
    expect(textOf(layers, 'headline')).toBe('Grow something')
    expect(textOf(layers, 'call-to-action')).toBe('Start today')
  })

  it('puts a layout box on its text layer and leaves the others alone', () => {
    const master = masterLayers(plan())
    const box = {
      slot: 'headline',
      x: 10,
      y: 20,
      width: 300,
      height: 100,
      fontSize: 40,
      color: '#112233',
      align: 'center' as const,
    }
    const placed = withLayout(master, [box])
    const headline = placed.find((l) => l.key === 'headline')
    expect(headline?.geometry).toMatchObject({ x: 10, y: 20, width: 300, height: 100 })
    expect(headline?.style).toMatchObject({ fontSize: 40, color: '#112233', align: 'center' })
    expect(placed.find((l) => l.key === 'call-to-action')).toEqual(
      master.find((l) => l.key === 'call-to-action'),
    )
  })

  it('makes one variant per size and language, sizes first', () => {
    expect(variantsOf().map((v) => `${v.language} ${v.size.label}`)).toEqual([
      'en 1x1',
      'fr 1x1',
      'de 1x1',
      'en 9x16',
      'fr 9x16',
      'de 9x16',
    ])
  })

  it('gives every language of a size the same boxes and styles', () => {
    const variants = variantsOf()
    for (const label of ['1x1', '9x16']) {
      const [first, ...others] = variants.filter((v) => v.size.label === label)
      for (const other of others) {
        expect(other.layers.map((l) => l.geometry)).toEqual(first?.layers.map((l) => l.geometry))
        expect(other.layers.map((l) => l.style)).toEqual(first?.layers.map((l) => l.style))
      }
    }
  })

  it("fills another language from the brief's copy, or leaves it for translation", () => {
    const variants = variantsOf()
    const fr = variants.find((v) => v.language === 'fr')
    const de = variants.find((v) => v.language === 'de')
    expect(textOf(fr?.layers ?? [], 'headline')).toBe('Faites pousser')
    expect(fr?.layers.find((l) => l.key === 'headline')?.translationSource).toBe('brief')
    expect(de?.layers.find((l) => l.key === 'headline')?.translationStatus).toBe('missing')
    expect(missingItems(variants, 'fr')).toEqual([])
    expect(missingItems(variants, 'de')).toEqual([
      { key: 'headline', text: 'Grow something' },
      { key: 'call-to-action', text: 'Start today' },
    ])
  })

  it('writes a translation only to its own language', () => {
    const items = [{ key: 'headline', text: 'Lass etwas wachsen' }]
    const variants = variantsOf().map((v) => withTranslations(v, 'de', items))
    for (const variant of variants) {
      const headline = variant.layers.find((l) => l.key === 'headline')
      if (variant.language !== 'de') expect(headline?.copy).not.toBe('Lass etwas wachsen')
      else {
        expect(headline?.copy).toBe('Lass etwas wachsen')
        expect(headline?.translationSource).toBe('ai')
      }
    }
    const action = variants
      .find((v) => v.language === 'de')
      ?.layers.find((l) => l.key === 'call-to-action')
    expect(action?.translationStatus).toBe('missing')
  })

  it('places the first picture inside another size, then fills the canvas with the extend', () => {
    const tall = variantsOf().find((v) => v.size.label === '9x16')
    if (!tall) throw new Error('no 9x16 variant')
    expect(fillPlacement(tall)).toEqual({ x: 0, y: 420, width: 1080, height: 1080 })
    const background = withFill(tall).layers.find((l) => l.type === 'background')
    expect(background?.source).toEqual({ assetId: 'fill-9x16' })
    expect(background?.geometry).toMatchObject({ x: 0, y: 0, width: 1080, height: 1920 })
  })
})
