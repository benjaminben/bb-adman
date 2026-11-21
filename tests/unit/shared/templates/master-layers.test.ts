import { describe, it, expect } from 'vitest'
import { buildMasterLayers } from '@/shared/templates/master-layers'
import { starterTemplate } from '@/shared/templates/starter'
import type { NewLayer, SlotFills } from '@/shared/templates/types'
import type { CampaignSize } from '@/shared/schemas/commands/campaign'
import { LayerRow } from '@/shared/schemas/rows/layer'

const ALL_FILLS: SlotFills = {
  background: { assetId: 'asset-bg' },
  'subject-image': { assetId: 'asset-subject' },
  logo: { assetId: 'asset-logo' },
  headline: { text: 'Fresh for summer' },
  'call-to-action': { text: 'Shop now' },
}

function size(width: number, height: number, label = `${width}x${height}`): CampaignSize {
  return { label, width, height }
}

type Box = [number, number, number, number]

function boxes(layers: NewLayer[]): Record<string, Box> {
  return Object.fromEntries(
    layers.map((l) => [l.key, [l.geometry.x, l.geometry.y, l.geometry.width, l.geometry.height]]),
  )
}

function fontSize(layer: NewLayer | undefined): number | undefined {
  return layer && 'fontSize' in layer.style ? layer.style.fontSize : undefined
}

// spec/starter-layouts.md, layout 1 (photo-bottom-left), the default. Each box is x, y,
// width, height.
describe('buildMasterLayers: worked boxes for the ready-made sizes [SPEC 6.1, 14 N3, LK-4]', () => {
  it.each([
    [size(1080, 1080, '1x1'), [292, 151, 497, 497], [65, 670, 950, 238], [65, 918, 454, 97]],
    [size(1080, 1920, '9x16'), [292, 269, 497, 497], [65, 1190, 950, 422], [65, 1758, 454, 97]],
    [size(1920, 1080, '16x9'), [712, 151, 497, 497], [65, 670, 1790, 238], [65, 918, 454, 97]],
    [size(1080, 1350, '4x5'), [292, 189, 497, 497], [65, 837, 950, 297], [65, 1188, 454, 97]],
  ])('%o', (campaignSize, subject, headline, cta) => {
    const got = boxes(buildMasterLayers(starterTemplate, campaignSize, ALL_FILLS))
    expect(got).toEqual({
      background: [0, 0, campaignSize.width, campaignSize.height],
      'subject-image': subject,
      logo: [65, 65, 151, 151],
      headline,
      'call-to-action': cta,
    })
  })

  it('gives short copy the largest sizes, 81 and 38, when the smaller side is 1080', () => {
    const layers = buildMasterLayers(starterTemplate, size(1080, 1920, '9x16'), ALL_FILLS)
    expect(fontSize(layers.find((l) => l.key === 'headline'))).toBe(81)
    expect(fontSize(layers.find((l) => l.key === 'call-to-action'))).toBe(38)
  })

  // spec/starter-layouts.md "The starting font size", the worked values: plain words of at
  // most 9 letters (here 8 letters and a space).
  it.each([
    [size(1080, 1080, '1x1'), 11, 81],
    [size(1080, 1080, '1x1'), 60, 71],
    [size(1080, 1080, '1x1'), 120, 47],
    [size(1080, 1080, '1x1'), 300, 30],
    [size(1080, 1080, '1x1'), 1000, 22],
    [size(1080, 1920, '9x16'), 60, 81],
    [size(1080, 1920, '9x16'), 120, 63],
    [size(1080, 1920, '9x16'), 300, 42],
    [size(1080, 1920, '9x16'), 1000, 22],
  ])('at %o a headline of %i letters starts at size %i', (campaignSize, n, expected) => {
    const text = 'abcdefgh '.repeat(Math.ceil(n / 9)).slice(0, n)
    const layers = buildMasterLayers(starterTemplate, campaignSize, { headline: { text } })
    expect(fontSize(layers.find((l) => l.key === 'headline'))).toBe(expected)
  })

  it('gives a 40-letter call to action size 24 at 1080x1080', () => {
    const text = 'abcdefgh '.repeat(5).slice(0, 40)
    const fills = { 'call-to-action': { text } }
    const layers = buildMasterLayers(starterTemplate, size(1080, 1080, '1x1'), fills)
    expect(fontSize(layers.find((l) => l.key === 'call-to-action'))).toBe(24)
  })

  it('sets rotation 0 and crop null on every layer', () => {
    const layers = buildMasterLayers(starterTemplate, size(1080, 1080, '1x1'), ALL_FILLS)
    for (const l of layers) expect([l.geometry.rotation, l.geometry.crop]).toEqual([0, null])
  })
})

// 1200x628: S = 628, m = round(37.68) = 38, side = round(288.88) = 289. The button is
// round(263.76) = 264 by round(56.52) = 57 and ends one margin above the bottom.
describe('buildMasterLayers: a custom size follows the rule [SPEC 6.1, 14 N3, LK-4]', () => {
  const layers = buildMasterLayers(starterTemplate, size(1200, 628), ALL_FILLS)

  it('gives each box from W, H and the smaller side', () => {
    expect(boxes(layers)).toEqual({
      background: [0, 0, 1200, 628],
      'subject-image': [456, 88, 289, 289],
      logo: [38, 38, 88, 88],
      headline: [38, 389, 1124, 138],
      'call-to-action': [38, 533, 264, 57],
    })
  })

  it('gives text sizes from the smaller side', () => {
    expect(fontSize(layers.find((l) => l.key === 'headline'))).toBe(47)
    expect(fontSize(layers.find((l) => l.key === 'call-to-action'))).toBe(22)
  })
})

describe('buildMasterLayers: which layers, in which order [SPEC 6.1, 14 N3]', () => {
  const square = size(1080, 1080, '1x1')

  it('gives the background layer alone, with source null, for empty fills', () => {
    const layers = buildMasterLayers(starterTemplate, square, {})
    expect(layers.map((l) => [l.key, l.type, l.slot, l.z, l.source])).toEqual([
      ['background', 'background', 'background', 0, null],
    ])
  })

  it('gives two layers, z 0 and 1, when only the headline is filled', () => {
    const layers = buildMasterLayers(starterTemplate, square, { headline: { text: 'Hi' } })
    expect(layers.map((l) => [l.key, l.z])).toEqual([
      ['background', 0],
      ['headline', 1],
    ])
  })

  it('gives z 0 to 4 in the template order when all five are filled', () => {
    const layers = buildMasterLayers(starterTemplate, square, ALL_FILLS)
    expect(layers.map((l) => [l.key, l.z])).toEqual([
      ['background', 0],
      ['subject-image', 1],
      ['logo', 2],
      ['headline', 3],
      ['call-to-action', 4],
    ])
  })

  it('counts z with no gaps when a slot in the middle is empty', () => {
    const fills = { logo: { assetId: 'asset-logo' }, 'call-to-action': { text: 'Go' } }
    const layers = buildMasterLayers(starterTemplate, square, fills)
    expect(layers.map((l) => [l.key, l.z])).toEqual([
      ['background', 0],
      ['logo', 1],
      ['call-to-action', 2],
    ])
  })
})

describe('buildMasterLayers: the smallest and largest sizes [SPEC 6.1 1.26, 14 P5]', () => {
  it.each([size(50, 50), size(300, 50), size(8192, 8192)])('$label', (s) => {
    const layers = buildMasterLayers(starterTemplate, s, ALL_FILLS)
    expect(layers).toHaveLength(5)
    for (const [i, l] of layers.entries()) {
      const row = { ...l, id: `layer-${i}`, variantId: 'variant-1' }
      expect(LayerRow.safeParse(row).success).toBe(true)
      expect(l.geometry.width).toBeGreaterThan(0)
      expect(l.geometry.height).toBeGreaterThan(0)
      if ('fontSize' in l.style) expect(l.style.fontSize).toBeGreaterThan(0)
    }
  })
})
