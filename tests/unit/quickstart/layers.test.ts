import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { planNewVariant } from '@/shared/links/new-variant-plan'
import type { PlannedLayer } from '@/shared/links/fan-out-plan'
import { fitTranslatedText } from '@/shared/links/fit-text'
import { anchoredBox } from '@/shared/links/place-box'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { frameOf } from '@/shared/templates/layout-rules'
import {
  BODY_FONT_ASSET,
  HEADING_FONT_ASSET,
  LOGO_ASSET,
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

  it("builds the master from the brief's layout", () => {
    const top = readPlan(`${BRIEF}layout: photo-top-centre\n`, 'yaml')
    if (!top.ok) throw new Error(top.message)
    const headline = masterLayers(top.plan).find((l) => l.key === 'headline')
    expect(headline?.geometry.y).toBe(Math.round(0.08 * 1080))
    expect(headline?.style).toMatchObject({ allCaps: true })
  })

  it('puts the logo in the logo spot when there is one', () => {
    const layers = masterLayers(plan(), { logo: true, headingFont: false, bodyFont: false })
    expect(layers.find((l) => l.key === 'logo')?.source).toEqual({ assetId: LOGO_ASSET })
    expect(masterLayers(plan()).some((l) => l.key === 'logo')).toBe(false)
  })

  it('puts the heading font on the headline and the body font on the other text', () => {
    const layers = masterLayers(plan(), { logo: false, headingFont: true, bodyFont: true })
    const fontOf = (key: string) => {
      const style = layers.find((l) => l.key === key)?.style
      return style && 'fontAssetId' in style ? style.fontAssetId : undefined
    }
    expect(fontOf('headline')).toBe(HEADING_FONT_ASSET)
    expect(fontOf('call-to-action')).toBe(BODY_FONT_ASSET)
    const headingOnly = masterLayers(plan(), { logo: false, headingFont: true, bodyFont: false })
    const action = headingOnly.find((l) => l.key === 'call-to-action')?.style
    expect(action && 'fontAssetId' in action && action.fontAssetId).toBeNull()
  })

  it('colours the text with the nearest brand colour', () => {
    const coloured = readPlan(`${BRIEF}brand:\n  colours: ['#FFF6E5', '#0B3D2E']\n`, 'yaml')
    if (!coloured.ok) throw new Error(coloured.message)
    for (const layer of masterLayers(coloured.plan).filter((l) => l.type === 'text')) {
      expect('color' in layer.style && layer.style.color).toBe('#FFF6E5')
    }
  })

  it('puts the picture in the subject spot of a flat-colour layout', () => {
    const flat = readPlan(`${BRIEF}layout: flat-bottom-left\n`, 'yaml')
    if (!flat.ok) throw new Error(flat.message)
    const layers = masterLayers(flat.plan)
    const background = layers.find((l) => l.type === 'background')
    expect(background?.source).toBeNull()
    expect(background?.style).toMatchObject({ fillColor: '#FFD54A' })
    expect(layers.find((l) => l.key === 'subject-image')?.source).toEqual({
      assetId: MASTER_ASSET,
    })
  })
})

// MV-8: the quickstart plans and fits with the app's own rule.
const SPLASH = new URL('../../../quickstart/examples/summer-splash/brief.yaml', import.meta.url)
const BRAND = { logo: true, headingFont: true, bodyFont: true }

function splash() {
  const result = readPlan(readFileSync(SPLASH, 'utf8'), 'yaml')
  if (!result.ok) throw new Error(result.message)
  return result.plan
}

const sansIds = (layers: LayerRow[]) => layers.map(({ id: _id, variantId: _v, ...rest }) => rest)

describe("quickstart layers with the app's rule [MV-8]", () => {
  it.each([
    ['a brief with copy and a translation', plan],
    ['summer-splash with its brand', splash],
  ])('plans each variant as planNewVariant does from the master: %s', (_name, read) => {
    const p = read()
    const master = masterLayers(p, BRAND)
    const from = { ...p.sizes[0]!, language: 'en' }
    const campaign = { primaryLanguage: 'en', brief: p.brief }
    const plans = new Map<string, PlannedLayer[]>()
    for (const variant of planVariants(p, master, PICTURE)) {
      const { size, language } = variant
      const expected = planNewVariant({
        master: { width: from.width, height: from.height, language: 'en' },
        masterLayers: master,
        target: { width: size.width, height: size.height, language },
        fit: 'fill',
        pictureSize: PICTURE,
        sameSizePlan: plans.get(size.label) ?? null,
        layoutId: p.layout.id,
        campaign,
      })
      if (language === 'en') plans.set(size.label, expected)
      expect(sansIds(variant.layers), `${language} ${size.label}`).toEqual(expected)
    }
  })

  it("starts the logo, headline and button at the layout's margin at 16:9", () => {
    const p = splash()
    const list = planVariants(p, masterLayers(p, BRAND), { width: 1080, height: 1080 })
    for (const variant of list.filter((v) => v.size.label === '16x9')) {
      const margin = frameOf(variant.size).m
      for (const key of ['logo', 'headline', 'call-to-action']) {
        const layer = variant.layers.find((l) => l.key === key)
        expect(layer?.geometry.x, `${variant.language} ${key}`).toBe(margin)
      }
    }
  })

  it('fits a translated text longer than the first words with fitTranslatedText', () => {
    const p = plan()
    const master = masterLayers(p)
    const long = 'Lass in deinem Garten jeden Tag etwas ganz Neues und Wunderbares wachsen'
    const before = planVariants(p, master, PICTURE).find((v) => v.language === 'de')
    if (!before) throw new Error('no de variant')
    const headline = before.layers.find((l) => l.key === 'headline')
    if (!headline) throw new Error('no headline')
    const masterHeadline = master.find((l) => l.key === 'headline') ?? null
    const fit = fitTranslatedText(headline, long, before.size, masterHeadline)
    expect(fit).not.toBeNull()
    const after = withTranslations(before, 'de', [{ key: 'headline', text: long }], master)
    const written = after.layers.find((l) => l.key === 'headline')
    expect(written?.copy).toBe(long)
    expect(written?.style).toEqual(fit?.style)
    expect(written?.overrides).toEqual(fit?.overrides)
  })

  it('anchors the boxes an AI layout call moved', () => {
    const p = plan()
    const box = {
      slot: 'headline',
      x: 40,
      y: 500,
      width: 600,
      height: 200,
      fontSize: 60,
      color: '#112233',
      align: 'left' as const,
    }
    const master = withLayout(masterLayers(p), [box])
    const moved = master.find((l) => l.key === 'headline')
    if (!moved) throw new Error('no headline')
    const tall = planVariants(p, master, PICTURE).find(
      (v) => v.language === 'en' && v.size.label === '9x16',
    )
    const first = p.sizes[0]!
    const target = { width: 1080, height: 1920 }
    const expected = anchoredBox(moved.geometry, first, target, true)
    expect(tall?.layers.find((l) => l.key === 'headline')?.geometry).toEqual(expected)
  })
})
