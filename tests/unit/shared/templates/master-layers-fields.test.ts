import { describe, it, expect } from 'vitest'
import { buildMasterLayers } from '../../../../src/shared/templates/master-layers'
import { starterTemplate } from '../../../../src/shared/templates/starter'
import { LayerRow } from '../../../../src/shared/schemas/rows/layer'
import type { SlotFills, Template } from '../../../../src/shared/templates/types'
import * as layout from '../../../../src/shared/config/default-layout'

const square = { label: '1x1', width: 1080, height: 1080 }
const ALL_FILLS: SlotFills = {
  background: { assetId: 'asset-bg' },
  'subject-image': { assetId: 'asset-subject' },
  logo: { assetId: 'asset-logo' },
  headline: { text: '  Fresh for summer  ' },
  'call-to-action': { text: 'Shop now' },
}
const zero = { copy: 0, style: 0, geometry: 0, source: 0, timing: 0, animation: 0 }
const still = { preset: 'none', startMs: 0, durationMs: 0 }
const headlineStyle = {
  fontAssetId: null,
  fontSize: 76,
  fontWeight: 700,
  color: '#FFFFFF',
  align: 'center',
  lineHeight: 1.1,
  letterSpacing: 0,
}

describe('buildMasterLayers: the fields of each layer [SPEC 6.1, 14 N3]', () => {
  const layers = buildMasterLayers(starterTemplate, square, ALL_FILLS)

  it('passes the LayerRow schema once given an id and a variantId', () => {
    for (const [i, l] of layers.entries()) {
      expect(LayerRow.safeParse({ ...l, id: `layer-${i}`, variantId: 'variant-1' }).success).toBe(
        true,
      )
    }
  })

  it('gives each slot its key, name, type, copy and source', () => {
    expect(layers.map((l) => [l.key, l.name, l.type, l.slot, l.copy, l.source])).toEqual([
      ['background', 'Background', 'background', 'background', null, { assetId: 'asset-bg' }],
      [
        'subject-image',
        'Subject image',
        'image',
        'subject-image',
        null,
        { assetId: 'asset-subject' },
      ],
      ['logo', 'Logo', 'image', 'logo', null, { assetId: 'asset-logo' }],
      ['headline', 'Headline', 'text', 'headline', '  Fresh for summer  ', null],
      ['call-to-action', 'Call to action', 'text', 'call-to-action', 'Shop now', null],
    ])
  })

  it('gives image layers opacity 1 and text layers their text style', () => {
    expect(layers.map((l) => l.style)).toEqual([
      { opacity: 1 },
      { opacity: 1 },
      { opacity: 1 },
      headlineStyle,
      { ...headlineStyle, fontSize: 38, fontWeight: 600, lineHeight: 1.2 },
    ])
  })

  it('gives every layer the same fixed values, with null translation fields', () => {
    for (const l of layers) {
      expect(l).toMatchObject({
        visible: true,
        locked: false,
        linked: false,
        overrides: [],
        timing: { startMs: 0, endMs: null },
        animation: { entrance: still, exit: still },
        revs: zero,
        syncedRevs: zero,
        translationStatus: null,
        translationSource: null,
        overflow: false,
      })
    }
  })
})

describe('buildMasterLayers: other templates [SPEC 6.1, 14 N3]', () => {
  it('gives a template without a background slot a background layer with slot null', () => {
    const template: Template = { id: 't', name: 'T', slots: [{ id: 'headline', type: 'copy' }] }
    const layers = buildMasterLayers(template, square, { headline: { text: 'Hi' } })
    expect(layers.map((l) => [l.key, l.slot, l.z, l.source])).toEqual([
      ['background', null, 0, null],
      ['headline', 'headline', 1, null],
    ])
  })

  it('uses the "any other" rows for slots the layout does not name', () => {
    const template: Template = {
      id: 't',
      name: 'T',
      slots: [
        { id: 'sticker', type: 'image' },
        { id: 'tagline', type: 'copy' },
      ],
    }
    const fills = { sticker: { assetId: 'asset-s' }, tagline: { text: 'Hello' } }
    const [, sticker, tagline] = buildMasterLayers(template, square, fills)
    expect(sticker).toMatchObject({ key: 'sticker', name: 'sticker', type: 'image' })
    expect(sticker?.geometry).toMatchObject({ x: 292, y: 292, width: 497, height: 497 })
    expect(sticker?.style).toEqual({ opacity: 1 })
    expect(tagline).toMatchObject({ key: 'tagline', name: 'tagline', type: 'text', copy: 'Hello' })
    expect(tagline?.geometry).toMatchObject({ x: 65, y: 454, width: 950, height: 173 })
    expect(tagline?.style).toEqual(headlineStyle)
  })
})

describe('buildMasterLayers: programming errors throw [SPEC 14 1.9]', () => {
  it('throws for a slot ID the template does not have', () => {
    expect(() => buildMasterLayers(starterTemplate, square, { sticker: { text: 'x' } })).toThrow(
      Error,
    )
  })

  it('throws for a fill of the wrong sort', () => {
    expect(() => buildMasterLayers(starterTemplate, square, { logo: { text: 'x' } })).toThrow(Error)
    expect(() =>
      buildMasterLayers(starterTemplate, square, { headline: { assetId: 'asset-a' } }),
    ).toThrow(Error)
  })
})

describe('buildMasterLayers: shares nothing [SPEC 14 N3]', () => {
  it('changing a returned layer changes neither a second call nor the config', () => {
    const before = JSON.stringify(layout)
    const first = buildMasterLayers(starterTemplate, square, ALL_FILLS)
    const expected = buildMasterLayers(starterTemplate, square, ALL_FILLS)
    for (const l of first) {
      l.overrides.push('copy')
      l.timing.endMs = 5
      l.animation.entrance.durationMs = 9
      l.revs.copy = 3
      l.syncedRevs.style = 3
      l.geometry.x = -1
      if ('opacity' in l.style) l.style.opacity = 0
      else l.style.color = '#000000'
      if (l.source) l.source.assetId = 'changed'
    }
    expect(buildMasterLayers(starterTemplate, square, ALL_FILLS)).toEqual(expected)
    expect(JSON.stringify(layout)).toBe(before)
    expect(ALL_FILLS.logo).toEqual({ assetId: 'asset-logo' })
  })
})
