// spec/make-variants.md "Which layout", "A layer a sync adds": the layer is planned alone, but
// its layout is found from all of the master's layers. Kept apart from sync-plan.test.ts, which
// is at the line limit.
import { describe, expect, it } from 'vitest'
import { syncPreviewOf, type SyncPlanInput } from '@/shared/links/sync-plan'
import { anchoredBox } from '@/shared/links/place-box'
import { layoutBoxOf } from '@/shared/links/source-layout'
import { DEFAULT_STARTER_LAYOUT, type StarterLayout } from '@/shared/config/default-layout'
import { starterLayoutOf } from '@/shared/config/starter-layouts'
import { buildMasterLayers } from '@/shared/templates/master-layers'
import { starterTemplate } from '@/shared/templates/starter'
import type { Geometry } from '@/shared/schemas/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { SlotFills } from '@/shared/templates/types'

const square = { id: 'm', width: 1080, height: 1080, language: 'en' }
const tall = { id: 'v', width: 1080, height: 1920, language: 'en' }
const fills = { headline: { text: 'Hi' }, 'call-to-action': { text: 'Go' } } as SlotFills
const other = starterLayoutOf('flat-centre-top') as StarterLayout

const built = (layout: StarterLayout): LayerRow[] =>
  buildMasterLayers(starterTemplate, { label: '1x1', ...square }, fills, layout).map((l) => ({
    ...l,
    id: `m-${l.key}`,
    variantId: 'm',
  }))

// The add-layer change for the headline, on a 1080 × 1920 variant that lacks it.
function addedHeadline(master: LayerRow[]) {
  const layers = master
    .filter((l) => l.key !== 'headline')
    .map((l) => ({ ...l, id: `v-${l.key}`, variantId: 'v', linked: true, syncedRevs: l.revs }))
  const input: SyncPlanInput = {
    master: { row: square, layers: master },
    variants: [{ row: tall, layers }],
    pictureSizes: {},
  }
  const changes = syncPreviewOf(input)[0]?.changes ?? []
  return changes.find((c) => c.layerKey === 'headline')
}

describe('syncPreviewOf, an added layer finds its layout from the whole master [MV-4]', () => {
  it("lands on the master's own layout box at the new size, not the default's", () => {
    const change = addedHeadline(built(other))
    expect(change?.kind).toBe('add-layer')
    expect(change?.proposed.geometry).toEqual(layoutBoxOf(other, { key: 'headline' }, tall))
    expect(change?.proposed.geometry).not.toEqual(
      layoutBoxOf(DEFAULT_STARTER_LAYOUT, { key: 'headline' }, tall),
    )
  })

  it("a layer moved onto another layout's box is anchored, as the whole master gives", () => {
    const moved = layoutBoxOf(other, { key: 'headline' }, square) as Geometry
    const master = built(DEFAULT_STARTER_LAYOUT).map((l) =>
      l.key === 'headline' ? { ...l, geometry: moved } : l,
    )
    const change = addedHeadline(master)
    expect(change?.proposed.geometry).toEqual(anchoredBox(moved, square, tall, true))
    expect(change?.proposed.geometry).not.toEqual(layoutBoxOf(other, { key: 'headline' }, tall))
  })
})
