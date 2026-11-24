import { describe, it, expect } from 'vitest'
import { layoutBoxOf, layoutOfLayers, sitsAsLaidOut } from '@/shared/links/source-layout'
import { buildMasterLayers } from '@/shared/templates/master-layers'
import { starterTemplate } from '@/shared/templates/starter'
import { frameOf, geometryOf } from '@/shared/templates/layout-rules'
import { STARTER_LAYOUTS, starterLayoutOf } from '@/shared/config/starter-layouts'
import type { NewLayer, SlotFills } from '@/shared/templates/types'
import { DEFAULT_STARTER_LAYOUT, type StarterLayout } from '@/shared/config/default-layout'

const FILLS: SlotFills = {
  background: { assetId: 'asset-bg' },
  'subject-image': { assetId: 'asset-subject' },
  logo: { assetId: 'asset-logo' },
  headline: { text: 'Fresh for summer' },
  'call-to-action': { text: 'Shop now' },
}
const SQUARE = { label: '1x1', width: 1080, height: 1080 }
const TALL = { label: '9x16', width: 1080, height: 1920 }

const layoutNamed = (id: string): StarterLayout => {
  const layout = starterLayoutOf(id)
  if (!layout) throw new Error(`no layout ${id}`)
  return layout
}
const DEFAULT = DEFAULT_STARTER_LAYOUT
const master = (layout: StarterLayout, size = SQUARE) =>
  buildMasterLayers(starterTemplate, size, FILLS, layout)
const withKey = (layers: NewLayer[], key: string) => {
  const layer = layers.find((l) => l.key === key)
  if (!layer) throw new Error(`no layer ${key}`)
  return layer
}
const moved = (layers: NewLayer[], key: string, change: Partial<NewLayer['geometry']>) =>
  layers.map((l) => (l.key === key ? { ...l, geometry: { ...l.geometry, ...change } } : l))

const CASES = STARTER_LAYOUTS.flatMap((layout) =>
  [SQUARE, TALL].map((size) => [layout.id, size.label, layout, size] as const),
)

describe('layoutOfLayers: which layout [spec/make-variants.md "Which layout"]', () => {
  it.each(CASES)('a master built with %s at %s gives that layout', (_, __, layout, size) => {
    expect(layoutOfLayers(master(layout, size), size, null)?.id).toBe(layout.id)
  })

  it.each(CASES)('with the logo moved by 1 pixel, %s at %s still', (_, __, layout, size) => {
    const logo = withKey(master(layout, size), 'logo')
    const layers = moved(master(layout, size), 'logo', { x: logo.geometry.x + 1 })
    expect(layoutOfLayers(layers, size, null)?.id).toBe(layout.id)
    for (const layer of layers) {
      if (layer.key === 'background') continue
      expect(sitsAsLaidOut(layout, layer, size)).toBe(layer.key !== 'logo')
    }
  })

  it('gives null when no layer sits in any layout', () => {
    const layers = master(DEFAULT).map((l) =>
      l.key === 'background' ? l : { ...l, geometry: { ...l.geometry, x: l.geometry.x + 3 } },
    )
    expect(layoutOfLayers(layers, SQUARE, null)).toBeNull()
  })

  it('gives null for no layers at all', () => {
    expect(layoutOfLayers([], SQUARE, DEFAULT.id)).toBeNull()
  })

  // Only the logo sits: at margin, margin it is the logo of layouts 1, 3 and 5.
  const logoOnly = () => [withKey(master(DEFAULT), 'logo')]

  it('gives a tie to preferredId when it is among the tied', () => {
    expect(layoutOfLayers(logoOnly(), SQUARE, 'flat-bottom-left')?.id).toBe('flat-bottom-left')
    expect(layoutOfLayers(logoOnly(), SQUARE, 'photo-label-box')?.id).toBe('photo-label-box')
  })

  it('gives a tie to the first in STARTER_LAYOUTS order otherwise', () => {
    expect(layoutOfLayers(logoOnly(), SQUARE, 'photo-top-centre')?.id).toBe(DEFAULT.id)
    expect(layoutOfLayers(logoOnly(), SQUARE, null)?.id).toBe(DEFAULT.id)
  })

  it('does not let preferredId outvote a layout more layers sit in', () => {
    expect(layoutOfLayers(master(DEFAULT), SQUARE, 'photo-label-box')?.id).toBe(DEFAULT.id)
  })
})

describe('sitsAsLaidOut [spec/make-variants.md "Which layout"]', () => {
  it('is true for each laid-out box of the master', () => {
    const layers = master(DEFAULT).filter((l) => l.key !== 'background')
    for (const layer of layers) expect(sitsAsLaidOut(DEFAULT, layer, SQUARE)).toBe(true)
  })

  it('does not count a rotated box', () => {
    const layer = withKey(master(DEFAULT), 'headline')
    const rotated = { ...layer, geometry: { ...layer.geometry, rotation: 5 } }
    expect(sitsAsLaidOut(DEFAULT, rotated, SQUARE)).toBe(false)
  })

  it('never counts the background', () => {
    const background = withKey(master(DEFAULT), 'background')
    const asSlot = {
      ...background,
      key: 'logo',
      geometry: withKey(master(DEFAULT), 'logo').geometry,
    }
    expect(sitsAsLaidOut(DEFAULT, background, SQUARE)).toBe(false)
    expect(sitsAsLaidOut(DEFAULT, asSlot, SQUARE)).toBe(false)
  })

  it('does not count a text layer on a picture slot, nor a picture on a text slot', () => {
    const logo = withKey(master(DEFAULT), 'logo')
    const headline = withKey(master(DEFAULT), 'headline')
    expect(sitsAsLaidOut(DEFAULT, { ...logo, type: 'text' }, SQUARE)).toBe(false)
    expect(sitsAsLaidOut(DEFAULT, { ...headline, type: 'image' }, SQUARE)).toBe(false)
  })

  it('does not count a key the layout does not name', () => {
    const logo = withKey(master(DEFAULT), 'logo')
    expect(sitsAsLaidOut(DEFAULT, { ...logo, key: 'sticker' }, SQUARE)).toBe(false)
    expect(sitsAsLaidOut(DEFAULT, { ...logo, key: 'constructor' }, SQUARE)).toBe(false)
  })

  it('compares with the box at the source size', () => {
    const headline = withKey(master(DEFAULT, TALL), 'headline')
    expect(sitsAsLaidOut(DEFAULT, headline, TALL)).toBe(true)
    expect(sitsAsLaidOut(DEFAULT, headline, SQUARE)).toBe(false)
  })
})

describe('layoutBoxOf [spec/make-variants.md "Where a box goes in a new size"]', () => {
  it.each(CASES)(
    'for %s at %s equals geometryOf(slot.box, frameOf(size))',
    (_, __, layout, size) => {
      for (const layer of master(DEFAULT)) {
        const slot = Object.hasOwn(layout.slots, layer.key) ? layout.slots[layer.key] : undefined
        const expected = slot ? geometryOf(slot.box, frameOf(size)) : null
        expect(layoutBoxOf(layout, layer, size)).toEqual(expected)
      }
    },
  )

  it('is null for a key the layout does not name', () => {
    const logo = withKey(master(DEFAULT), 'logo')
    expect(layoutBoxOf(DEFAULT, { ...logo, key: 'sticker' }, SQUARE)).toBeNull()
    expect(
      layoutBoxOf(layoutNamed('flat-centre-top'), { ...logo, key: 'toString' }, SQUARE),
    ).toBeNull()
  })
})
