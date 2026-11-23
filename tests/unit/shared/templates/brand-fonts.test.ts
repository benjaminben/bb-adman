import { describe, it, expect } from 'vitest'
import { brandFontRole, withBrandFonts } from '@/shared/templates/brand-fonts'
import { buildMasterLayers } from '@/shared/templates/master-layers'
import { starterTemplate } from '@/shared/templates/starter'
import type { NewLayer } from '@/shared/templates/types'

const SQUARE = { label: '1x1', width: 1080, height: 1080 }

// A master of the starter template with every slot filled, plus a user text layer "note".
function master(): NewLayer[] {
  const fills = {
    background: { assetId: 'bg' },
    'subject-image': { assetId: 'subject' },
    logo: { assetId: 'logo' },
    headline: { text: 'Fresh for summer' },
    'call-to-action': { text: 'Shop now' },
  }
  const layers = buildMasterLayers(starterTemplate, SQUARE, fills)
  const cta = layers.find((l) => l.key === 'call-to-action')!
  return [...layers, { ...structuredClone(cta), key: 'note', slot: null, z: layers.length }]
}

const fontOf = (layers: NewLayer[], key: string) => {
  const style = layers.find((l) => l.key === key)?.style
  return style && 'fontAssetId' in style ? style.fontAssetId : undefined
}

describe('brandFontRole [spec/brief-brand.md "Shared helpers", A-398]', () => {
  it.each([
    ['headline', 'heading'],
    ['call-to-action', 'body'],
    ['note', 'body'],
    ['', 'body'],
  ])('%s is %s', (key, role) => {
    expect(brandFontRole(key)).toBe(role)
  })
})

describe('withBrandFonts [spec/brief-brand.md "The rules", A-398]', () => {
  it('puts the heading font on the headline and the body font on every other text layer', () => {
    const got = withBrandFonts(master(), { heading: 'font-h', body: 'font-b' })
    expect(fontOf(got, 'headline')).toBe('font-h')
    expect(fontOf(got, 'call-to-action')).toBe('font-b')
    expect(fontOf(got, 'note')).toBe('font-b')
  })

  it('leaves picture and background layers as they were', () => {
    const before = master()
    const got = withBrandFonts(before, { heading: 'font-h', body: 'font-b' })
    for (const key of ['background', 'subject-image', 'logo']) {
      expect(got.find((l) => l.key === key)).toEqual(before.find((l) => l.key === key))
    }
  })

  it('keeps the layer its own font when the brief gives no heading font', () => {
    const got = withBrandFonts(master(), { body: 'font-b' })
    expect(fontOf(got, 'headline')).toBeNull()
    expect(fontOf(got, 'call-to-action')).toBe('font-b')
  })

  it('keeps the layer its own font when the brief gives no body font', () => {
    const got = withBrandFonts(master(), { heading: 'font-h' })
    expect(fontOf(got, 'headline')).toBe('font-h')
    expect(fontOf(got, 'call-to-action')).toBeNull()
    expect(fontOf(got, 'note')).toBeNull()
  })

  it('changes nothing else of a text layer', () => {
    const before = master()
    const got = withBrandFonts(before, { heading: 'font-h', body: 'font-b' })
    const strip = (layers: NewLayer[]) =>
      layers.map((l) => ({ ...l, style: { ...l.style, fontAssetId: null } }))
    expect(strip(got)).toEqual(strip(before))
  })

  it('gives fresh copies and leaves the input unchanged', () => {
    const before = master()
    const snapshot = structuredClone(before)
    const got = withBrandFonts(before, { heading: 'font-h', body: 'font-b' })
    expect(before).toEqual(snapshot)
    got.forEach((layer, i) => {
      expect(layer).not.toBe(before[i])
      expect(layer.style).not.toBe(before[i]!.style)
      expect(layer.geometry).not.toBe(before[i]!.geometry)
    })
  })
})
