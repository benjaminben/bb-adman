// P3-3: the missingFile badge counts a text layer's font as well as a layer's source
// (spec/api-queries-events.md, "Computed badges and job marks").
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { makeCampaignBus, insertImage, type CampaignBus } from '../campaigns/campaign-fixture'
import { testDeps } from '../campaigns/campaign-deps'
import { campaignQueries } from '@/main/queries/campaign'
import { variantQueries } from '@/main/queries/variant'
import type { CoreDeps } from '@/main/core-deps'
import type { CampaignGet } from '@/shared/schemas/queries/campaign'
import type { VariantGet } from '@/shared/schemas/queries/variant'
import type { LayerRow } from '@/shared/schemas/rows/layer'

let bus: CampaignBus
let deps: CoreDeps
let campaignId: string
let variantId: string
const opts = { actor: 'user' as const }
const missing: string[] = []

beforeEach(async () => {
  bus = makeCampaignBus()
  missing.length = 0
  deps = testDeps({
    projects: bus.projects,
    assets: { missingAssetIds: async () => [...missing] } as unknown as CoreDeps['assets'],
    log: { write: () => undefined } as unknown as CoreDeps['log'],
  })
  const made = (await bus.create()) as { data: { campaignId: string; variantId: string } }
  campaignId = made.data.campaignId
  variantId = made.data.variantId
  insertImage(bus, { id: 'FONT', kind: 'font' })
})
afterEach(() => bus.cleanup())

async function badges(): Promise<Array<boolean | undefined>> {
  const p = { projectId: bus.projectId }
  const campaign = (await campaignQueries(deps)['campaign.get']?.(
    { ...p, campaignId },
    opts,
  )) as CampaignGet
  const variant = (await variantQueries(deps)['variant.get']?.(
    { ...p, variantId },
    opts,
  )) as VariantGet
  return [campaign.variants[0]?.badges.missingFile, variant.variant.badges.missingFile]
}

function setFont(fontAssetId: string | null): void {
  const text = (bus.rows('layer') as LayerRow[]).find(
    (l) => l.variantId === variantId && l.type === 'text',
  )
  if (!text) throw new Error('the starter template has no text layer')
  bus.db
    .prepare("UPDATE layer SET style = json_set(style, '$.fontAssetId', ?) WHERE id = ?")
    .run(fontAssetId, text.id)
}

describe('missingFile counts fonts [spec/api-queries-events.md, Computed badges; P3-3]', () => {
  it.each([
    ['a font in the missing list', 'FONT', ['FONT'], true],
    ['a font that is found', 'FONT', [], false],
    ['a null font (the bundled default)', null, ['FONT'], false],
  ] as const)('sets campaign.get and variant.get alike, with %s', async (_n, font, gone, want) => {
    missing.push(...gone)
    setFont(font)
    expect(await badges()).toEqual([want, want])
  })
})
