// spec/editor.md, "Thumbnails on the screens": each campaign summary of project.get names the
// master of the campaign's first direction with its rev, or null when there is none.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { makeCampaignBus, type CampaignBus } from '../campaigns/campaign-fixture'
import { testDeps } from '../campaigns/campaign-deps'
import { insertCampaign } from '../row-fixtures'
import { projectQueries } from '@/main/queries/project'
import type { CoreDeps } from '@/main/core-deps'
import type { ProjectGet } from '@/shared/schemas/queries/campaign'
import type { DirectionRow } from '@/shared/schemas/rows/direction'

let bus: CampaignBus
let deps: CoreDeps

beforeEach(() => {
  bus = makeCampaignBus()
  deps = testDeps({
    projects: bus.projects,
    assets: { missingAssetIds: async () => [] } as unknown as CoreDeps['assets'],
  })
})
afterEach(() => bus.cleanup())

async function covers(): Promise<Record<string, ProjectGet['campaigns'][number]['cover']>> {
  const get = projectQueries(deps)['project.get']
  const reply = (await get?.({ projectId: bus.projectId }, { actor: 'user' })) as ProjectGet
  return Object.fromEntries(reply.campaigns.map((c) => [c.id, c.cover]))
}

describe('project.get campaign cover [spec/editor.md, Thumbnails on the screens]', () => {
  it("names the master of the campaign's first direction with its rev", async () => {
    const made = (await bus.create()) as { data: { campaignId: string } }
    const campaignId = made.data.campaignId
    const [direction] = bus.rows('direction') as DirectionRow[]
    bus.db.prepare('UPDATE variant SET rev = 7 WHERE id = ?').run(direction?.masterVariantId)
    expect((await covers())[campaignId]).toEqual({
      variantId: direction?.masterVariantId,
      rev: 7,
    })
  })

  it('is null for a campaign with no variant', async () => {
    insertCampaign(bus.db, 'empty-k3f9q2')
    expect((await covers())['empty-k3f9q2']).toBeNull()
  })
})
