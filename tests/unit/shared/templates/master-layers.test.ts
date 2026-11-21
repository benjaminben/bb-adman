import { describe, it, expect } from 'vitest'
import { buildMasterLayers } from '../../../../src/shared/templates/master-layers'
import { starterTemplate } from '../../../../src/shared/templates/starter'
import type { NewLayer, SlotFills } from '../../../../src/shared/templates/types'
import type { CampaignSize } from '../../../../src/shared/schemas/commands/campaign'

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

// SPEC 6.1 "Default layout", the worked values table. Each box is x, y, width, height.
describe('buildMasterLayers: worked boxes for the ready-made sizes [SPEC 6.1, 14 N3]', () => {
  it.each([
    [size(1080, 1080, '1x1'), [292, 238, 497, 497], [65, 756, 950, 173], [65, 950, 950, 65]],
    [size(1080, 1920, '9x16'), [292, 422, 497, 497], [65, 1344, 950, 307], [65, 1690, 950, 115]],
    [size(1920, 1080, '16x9'), [712, 238, 497, 497], [65, 756, 1790, 173], [65, 950, 1790, 65]],
    [size(1080, 1350, '4x5'), [292, 297, 497, 497], [65, 945, 950, 216], [65, 1188, 950, 81]],
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

  it('gives text sizes 76 and 38 when the smaller side is 1080', () => {
    const layers = buildMasterLayers(starterTemplate, size(1080, 1920, '9x16'), ALL_FILLS)
    expect(fontSize(layers.find((l) => l.key === 'headline'))).toBe(76)
    expect(fontSize(layers.find((l) => l.key === 'call-to-action'))).toBe(38)
  })

  it('sets rotation 0 and crop null on every layer', () => {
    const layers = buildMasterLayers(starterTemplate, size(1080, 1080, '1x1'), ALL_FILLS)
    for (const l of layers) expect([l.geometry.rotation, l.geometry.crop]).toEqual([0, null])
  })
})

// 1200x628: S = 628, m = round(37.68) = 38, side = round(288.88) = 289.
describe('buildMasterLayers: a custom size follows the rule [SPEC 6.1, 14 N3]', () => {
  const layers = buildMasterLayers(starterTemplate, size(1200, 628), ALL_FILLS)

  it('gives each box from W, H and the smaller side', () => {
    expect(boxes(layers)).toEqual({
      background: [0, 0, 1200, 628],
      'subject-image': [456, 138, 289, 289],
      logo: [38, 38, 88, 88],
      headline: [38, 440, 1124, 100],
      'call-to-action': [38, 553, 1124, 38],
    })
  })

  it('gives text sizes from the smaller side', () => {
    expect(fontSize(layers.find((l) => l.key === 'headline'))).toBe(44)
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
