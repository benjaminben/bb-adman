// R3-3: the Translations tab's rows follow the Variants tab's order (direction-order.ts drawn
// by grid-axes.ts): the campaign's directions, then inside a direction the master's size first,
// then the sizes order, image before video. The language blocks follow the campaign's languages, the primary language first.
import { describe, expect, it } from 'vitest'
import { directionOrder } from '@/renderer/screens/campaign/direction-grids/direction-order'
import { gridAxes } from '@/renderer/screens/campaign/variant-grid/grid-axes'
import {
  byDirection,
  languageOrder,
} from '@/renderer/screens/campaign/translation-panel/translation-order'
import type { CampaignGet, VariantSummary } from '@/shared/schemas/queries/campaign'
import { campaignGet, variant } from './campaign-fixture'

const size = (label: string, width: number, height: number) => ({ label, width, height })

function campaign(variants: VariantSummary[]): CampaignGet {
  const data = campaignGet(variants)
  data.campaign.sizes = [
    size('Square', 1080, 1080),
    size('Story', 1080, 1920),
    size('Wide', 1920, 1080),
  ]
  data.campaign.languages = ['en', 'de', 'fr']
  data.directions = [
    { id: 'D2', campaignId: 'C1', name: 'Night', masterVariantId: 'M2', sort: 0 },
    { id: 'D1', campaignId: 'C1', name: 'Day', masterVariantId: 'M1', sort: 1 },
  ]
  return data
}

// The master's size (Story) is not first in the campaign's sizes.
const VARIANTS = [
  variant('M1', { sizeLabel: 'Story', isMaster: true, createdAt: '2026-11-21T00:00:00.000Z' }),
  variant('W-de', { sizeLabel: 'Wide', language: 'de', createdAt: '2026-11-21T00:00:01.000Z' }),
  variant('S-de-video', {
    sizeLabel: 'Square',
    language: 'de',
    format: 'video',
    createdAt: '2026-11-21T00:00:02.000Z',
  }),
  variant('S-de', { sizeLabel: 'Square', language: 'de', createdAt: '2026-11-21T00:00:03.000Z' }),
  variant('T-de', { sizeLabel: 'Story', language: 'de', createdAt: '2026-11-21T00:00:04.000Z' }),
  variant('Sq-en', { sizeLabel: 'Square', createdAt: '2026-11-21T00:00:05.000Z' }),
  variant('M2', { directionId: 'D2', sizeLabel: 'Story', isMaster: true }),
  variant('N-de', { directionId: 'D2', sizeLabel: 'Square', language: 'de' }),
]

const rowOf = (v: VariantSummary) => ({
  directionId: v.directionId,
  variantId: v.id,
  layerId: `${v.id}-L`,
})

describe('the Translations tab order [R3-3]', () => {
  it("orders a language block's rows as the Variants tab orders that language's variants", () => {
    const data = campaign(VARIANTS)
    const german = VARIANTS.filter((v) => v.language === 'de')
    const rows = [...german].reverse().map(rowOf)
    const groups = byDirection(rows, data)
    expect(groups.map((g) => g.name)).toEqual(['Night', 'Day'])
    // The Variants tab draws gridAxes(directionOrder(...)): size rows, the master's size first.
    const variantsTab = data.directions.flatMap((d) =>
      gridAxes(
        directionOrder(
          data.variants.filter((v) => v.directionId === d.id),
          data.campaign,
          d.masterVariantId,
        ),
      )
        .cells.flatMap((c) => c.variants)
        .filter((v) => v.language === 'de'),
    )
    expect(groups.flatMap((g) => g.rows.map((r) => r.variantId))).toEqual(
      variantsTab.map((v) => v.id),
    )
    expect(groups[1]?.rows.map((r) => r.variantId)).toEqual(['T-de', 'S-de', 'S-de-video', 'W-de'])
  })

  it('puts the master first in the primary block, then the sizes order', () => {
    const data = campaign(VARIANTS)
    const rows = VARIANTS.filter((v) => v.language === 'en')
      .reverse()
      .map(rowOf)
    const day = byDirection(rows, data).find((g) => g.directionId === 'D1')
    expect(day?.rows.map((r) => r.variantId)).toEqual(['M1', 'Sq-en'])
  })

  it('keeps the rows of one variant in the order they came', () => {
    const data = campaign(VARIANTS)
    const rows = [
      { directionId: 'D1', variantId: 'W-de', layerId: 'b' },
      { directionId: 'D1', variantId: 'S-de', layerId: 'x' },
      { directionId: 'D1', variantId: 'W-de', layerId: 'a' },
    ]
    expect(byDirection(rows, data)[0]?.rows.map((r) => r.layerId)).toEqual(['x', 'b', 'a'])
  })

  it('puts a post or a direction the campaign does not list after the listed ones', () => {
    const data = campaign(VARIANTS)
    const rows = [
      { directionId: 'D9', variantId: 'Q', layerId: 'q' },
      { directionId: 'D1', variantId: 'unknown', layerId: 'u' },
      { directionId: 'D1', variantId: 'W-de', layerId: 'w' },
    ]
    const groups = byDirection(rows, data)
    expect(groups.map((g) => [g.directionId, g.rows.map((r) => r.layerId)])).toEqual([
      ['D1', ['w', 'u']],
      ['D9', ['q']],
    ])
  })

  it('orders the languages as the campaign lists them, the primary first', () => {
    const data = campaign(VARIANTS)
    data.campaign.languages = ['de', 'en', 'fr']
    expect(languageOrder(['fr', 'ja', 'de', 'en'], data.campaign)).toEqual(['en', 'de', 'fr', 'ja'])
  })
})
