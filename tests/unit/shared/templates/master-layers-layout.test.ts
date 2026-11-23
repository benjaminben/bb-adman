import { describe, it, expect } from 'vitest'
import { buildMasterLayers } from '@/shared/templates/master-layers'
import { starterLayoutPatches } from '@/shared/templates/starter-layout-patches'
import { starterTemplate } from '@/shared/templates/starter'
import { STARTER_LAYOUTS } from '@/shared/config/starter-layouts'
import type { NewLayer, SlotFills } from '@/shared/templates/types'
import type { CampaignSize } from '@/shared/schemas/commands/campaign'

const ALL_FILLS: SlotFills = {
  background: { assetId: 'asset-bg' },
  'subject-image': { assetId: 'asset-subject' },
  logo: { assetId: 'asset-logo' },
  headline: { text: 'Fresh for summer' },
  'call-to-action': { text: 'Shop now' },
}

const SIZES: CampaignSize[] = [
  { label: '1x1', width: 1080, height: 1080 },
  { label: '9x16', width: 1080, height: 1920 },
  { label: '16x9', width: 1920, height: 1080 },
  { label: '4x5', width: 1080, height: 1350 },
]

// The default build with a layout's patches applied, as "Layout…" would leave it.
function patched(layers: NewLayer[], patches: ReturnType<typeof starterLayoutPatches>) {
  return layers.map((layer) => {
    const patch = patches.find((p) => p.layerId === layer.key)?.patch
    if (!patch) return layer
    return {
      ...layer,
      geometry: { ...layer.geometry, ...patch.geometry },
      style: { ...layer.style, ...patch.style },
    }
  })
}

const CASES = STARTER_LAYOUTS.flatMap((layout) =>
  SIZES.map((size) => [layout.id, size.label, layout, size] as const),
)

describe('buildMasterLayers with a starter layout [spec/brief-brand.md "Shared helpers", BB-2]', () => {
  it.each(CASES)('%s at %s equals the default build with the layout applied', (...args) => {
    const [, , layout, size] = args
    const base = buildMasterLayers(starterTemplate, size, ALL_FILLS)
    const rows = base.map((l) => ({ ...l, id: l.key, variantId: 'v1' }))
    const expected = patched(base, starterLayoutPatches(layout, size, rows))
    expect(buildMasterLayers(starterTemplate, size, ALL_FILLS, layout)).toEqual(expected)
  })

  it.each(STARTER_LAYOUTS.map((l) => [l.id, l] as const))('%s keeps the slot names', (...args) => {
    const [, layout] = args
    const layers = buildMasterLayers(starterTemplate, SIZES[0]!, ALL_FILLS, layout)
    expect(layers.map((l) => l.name)).toEqual([
      'Background',
      'Subject image',
      'Logo',
      'Headline',
      'Call to action',
    ])
  })

  it('gives the same layers with no layout as with the default one', () => {
    const size = SIZES[1]!
    expect(buildMasterLayers(starterTemplate, size, ALL_FILLS, STARTER_LAYOUTS[0])).toEqual(
      buildMasterLayers(starterTemplate, size, ALL_FILLS),
    )
  })

  it('changes something for every layout other than the default', () => {
    const size = SIZES[0]!
    const base = buildMasterLayers(starterTemplate, size, ALL_FILLS)
    for (const layout of STARTER_LAYOUTS.slice(1)) {
      expect(buildMasterLayers(starterTemplate, size, ALL_FILLS, layout)).not.toEqual(base)
    }
  })
})
