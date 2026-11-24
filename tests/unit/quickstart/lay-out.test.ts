import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { laidOut } from '../../../quickstart/lay-out'
import {
  BODY_FONT_ASSET,
  HEADING_FONT_ASSET,
  LOGO_ASSET,
  masterLayers,
  planVariants,
  type Variant,
} from '../../../quickstart/layers'
import { readPlan } from '../../../quickstart/plan'

const SPLASH = new URL('../../../quickstart/examples/summer-splash/brief.yaml', import.meta.url)
const BRAND = { logo: true, headingFont: true, bodyFont: true }

function splash() {
  const result = readPlan(readFileSync(SPLASH, 'utf8'), 'yaml')
  if (!result.ok) throw new Error(result.message)
  return result.plan
}

function variants(): Variant[] {
  const plan = splash()
  return planVariants(plan, masterLayers(plan, BRAND), { width: 1080, height: 1080 })
}

const layerOf = (variant: Variant, key: string) => {
  const layer = variant.layers.find((l) => l.key === key)
  if (!layer) throw new Error(`no ${key} layer`)
  return layer
}
const styleOf = (layer: LayerRow) => layer.style as Record<string, unknown>
const find = (list: Variant[], language: string, size: string) => {
  const found = list.find((v) => v.language === language && v.size.label === size)
  if (!found) throw new Error(`no ${language} ${size}`)
  return found
}

describe('quickstart laidOut (step 2.6)', () => {
  it('lines up the left edges of the logo, headline and button at every size', () => {
    const plan = splash()
    for (const variant of variants()) {
      const done = laidOut(variant, plan.layout, plan.look.colours)
      const edges = ['logo', 'headline', 'call-to-action'].map((k) => layerOf(done, k).geometry.x)
      expect(new Set(edges).size, `${variant.language} ${variant.size.label}`).toBe(1)
    }
  })

  it('gives longer words a font size that suits them, in their own size', () => {
    const plan = splash()
    const list = variants().map((v) => laidOut(v, plan.layout, plan.look.colours))
    const size = (language: string) =>
      styleOf(layerOf(find(list, language, '16x9'), 'call-to-action')).fontSize as number
    expect(size('de')).toBeLessThan(size('en'))
  })

  it('keeps the brand fonts, the brand colours and the logo picture', () => {
    const plan = splash()
    for (const variant of variants()) {
      const done = laidOut(variant, plan.layout, plan.look.colours)
      expect(styleOf(layerOf(done, 'headline')).fontAssetId).toBe(HEADING_FONT_ASSET)
      expect(styleOf(layerOf(done, 'call-to-action')).fontAssetId).toBe(BODY_FONT_ASSET)
      for (const layer of done.layers.filter((l) => l.type === 'text')) {
        expect(plan.look.colours).toContain(styleOf(layer).color)
      }
      expect(layerOf(done, 'logo').source).toEqual({ assetId: LOGO_ASSET })
    }
  })

  it('keeps the words, the translation state and the background picture', () => {
    const plan = splash()
    const variant = find(variants(), 'de', '9x16')
    const done = laidOut(variant, plan.layout, plan.look.colours)
    for (const key of ['headline', 'call-to-action', 'background']) {
      const before = layerOf(variant, key)
      const after = layerOf(done, key)
      expect(after.copy).toBe(before.copy)
      expect(after.translationStatus).toBe(before.translationStatus)
      expect(after.source).toEqual(before.source)
    }
  })
})
