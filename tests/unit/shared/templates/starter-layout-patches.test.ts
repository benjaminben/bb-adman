import { describe, it, expect } from 'vitest'
import { starterLayoutPatches } from '@/shared/templates/starter-layout-patches'
import { buildMasterLayers } from '@/shared/templates/master-layers'
import { starterTemplate } from '@/shared/templates/starter'
import { STARTER_LAYOUTS } from '@/shared/config/starter-layouts'
import { layerUpdateManyInput } from '@/shared/schemas/commands/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { StarterLayout } from '@/shared/config/default-layout'

const SQUARE = { width: 1080, height: 1080 }
const layoutOf = (id: string): StarterLayout => {
  const found = STARTER_LAYOUTS.find((l) => l.id === id)
  if (!found) throw new Error(`no layout ${id}`)
  return found
}
const LABEL = layoutOf('photo-label-box')
const TOP = layoutOf('photo-top-centre')

// A master of the starter template with every slot filled, each layer given an ID.
function master(): LayerRow[] {
  const fills = {
    background: { assetId: 'bg' },
    'subject-image': { assetId: 'subject' },
    logo: { assetId: 'logo' },
    headline: { text: 'Fresh for summer' },
    'call-to-action': { text: 'Shop now' },
  }
  return buildMasterLayers(starterTemplate, { label: '1x1', ...SQUARE }, fills).map((l) => ({
    ...l,
    id: `id-${l.key}`,
    variantId: 'v1',
  }))
}

const patchFor = (updates: ReturnType<typeof starterLayoutPatches>, key: string) =>
  updates.find((u) => u.layerId === `id-${key}`)?.patch

describe('starterLayoutPatches [spec/starter-layouts.md "Applying a layout"]', () => {
  it('gives one update per named layer, in the layers order', () => {
    const updates = starterLayoutPatches(LABEL, SQUARE, master())
    expect(updates.map((u) => u.layerId)).toEqual([
      'id-background',
      'id-subject-image',
      'id-logo',
      'id-headline',
      'id-call-to-action',
    ])
  })

  it('leaves out a locked layer, a layer the layout does not name and one of the wrong type', () => {
    const layers = master().map((l) => (l.key === 'logo' ? { ...l, locked: true } : l))
    const [, , , headline] = layers
    if (!headline) throw new Error('no headline')
    layers.push({ ...headline, id: 'id-added', key: 'layer-x', slot: null })
    const subject = layers.find((l) => l.key === 'subject-image')
    if (subject) subject.type = 'text'
    const ids = starterLayoutPatches(LABEL, SQUARE, layers).map((u) => u.layerId)
    expect(ids).toEqual(['id-background', 'id-headline', 'id-call-to-action'])
  })

  it('gives an empty list when nothing is left', () => {
    const locked = master().map((l) => ({ ...l, locked: true }))
    expect(starterLayoutPatches(LABEL, SQUARE, locked)).toEqual([])
  })

  it('gives the background the whole canvas, rotation 0, its colour and shade', () => {
    expect(patchFor(starterLayoutPatches(TOP, SQUARE, master()), 'background')).toEqual({
      geometry: { x: 0, y: 0, width: 1080, height: 1080, rotation: 0 },
      style: {
        fillColor: null,
        shade: { color: '#000000', from: 'top', strength: 0.45, reach: 0.5 },
      },
    })
    const flat = layoutOf('flat-bottom-left')
    const wide = { width: 1920, height: 1080 }
    expect(patchFor(starterLayoutPatches(flat, wide, master()), 'background')).toEqual({
      geometry: { x: 0, y: 0, width: 1920, height: 1080, rotation: 0 },
      style: { fillColor: '#FFD54A', shade: null },
    })
  })

  it('gives a picture layer its box and shade, with crop, opacity and source untouched', () => {
    expect(patchFor(starterLayoutPatches(LABEL, SQUARE, master()), 'subject-image')).toEqual({
      geometry: { x: 292, y: 130, width: 497, height: 497, rotation: 0 },
      style: { shade: null },
    })
  })

  it('gives a text layer its box, its style and every look field, with no font and no copy', () => {
    const updates = starterLayoutPatches(LABEL, SQUARE, master())
    expect(patchFor(updates, 'headline')).toEqual({
      geometry: { x: 65, y: 648, width: 950, height: 259, rotation: 0 },
      style: {
        fontSize: 76,
        fontWeight: 700,
        color: '#111111',
        align: 'left',
        lineHeight: 1.1,
        letterSpacing: 0,
        verticalAlign: 'middle',
        allCaps: false,
        boxColor: '#FFFFFF',
        boxOutlineColor: null,
        boxOutlineWidth: 0,
        boxRadius: 13,
        boxPadding: 32,
      },
    })
    expect(patchFor(updates, 'call-to-action')?.style).toMatchObject({
      boxColor: '#111111',
      boxRadius: 49,
      boxPadding: 16,
    })
  })

  it('sizes the text from the layer’s current copy and the new box', () => {
    const layers = master().map((l) =>
      l.key === 'headline' ? { ...l, copy: 'abcdefgh '.repeat(14).slice(0, 120) } : l,
    )
    const updates = starterLayoutPatches(layoutOf('photo-bottom-left'), SQUARE, layers)
    expect(patchFor(updates, 'headline')?.style).toMatchObject({ fontSize: 47 })
  })

  it.each(STARTER_LAYOUTS.map((l) => [l.id, l] as const))(
    '%s gives updates that pass layerUpdateManyInput at every size',
    (_, layout) => {
      for (const size of [SQUARE, { width: 50, height: 8192 }, { width: 8192, height: 50 }]) {
        const updates = starterLayoutPatches(layout, size, master())
        const input = { projectId: 'p', variantId: 'v1', updates }
        expect(layerUpdateManyInput.safeParse(input).success).toBe(true)
      }
    },
  )
})
