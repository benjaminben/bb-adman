import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { makeCampaignBus, insertImage, type CampaignBus } from './campaign-fixture'
import { testDeps } from './campaign-deps'
import { templateQueries } from '@/main/queries/template'
import { projectQueries } from '@/main/queries/project'
import { starterTemplate } from '@/shared/templates/starter'
import type { CoreDeps } from '@/main/core-deps'

let bus: CampaignBus
let deps: CoreDeps
let campaignId: string
const opts = { actor: 'user' as const }
const missing: string[] = []

beforeEach(async () => {
  bus = makeCampaignBus()
  missing.length = 0
  deps = testDeps({
    projects: bus.projects,
    assets: { missingAssetIds: async () => [...missing] } as unknown as CoreDeps['assets'],
  })
  await bus.user('subject.create', { id: 'can', name: 'Can' })
  insertImage(bus, { id: 'HERO1', subjectId: 'can', createdAt: '2026-01-01T00:00:00.000Z' })
  insertImage(bus, { id: 'HERO2', subjectId: 'can', createdAt: '2026-02-01T00:00:00.000Z' })
  insertImage(bus, { id: 'REF', subjectId: 'can', library: 'reference' })
  insertImage(bus, { id: 'LOGO' })
  const made = (await bus.create({
    subjectMap: [
      { subjectId: 'can', create: false },
      { subjectId: 'bottle', create: true },
    ],
    ruleSet: { requiredAssetIds: ['LOGO'], palette: [], requiredWords: {}, prohibitedWords: {} },
  })) as { data: { campaignId: string } }
  campaignId = made.data.campaignId
})
afterEach(() => bus.cleanup())

const query =
  (map: Record<string, (i: unknown, o: typeof opts) => unknown>, name: string) =>
  async (input: Record<string, unknown>) =>
    map[name]?.({ projectId: bus.projectId, ...input }, opts)

describe('template.list [SPEC 4.3]', () => {
  it('gives the starter template, the only one in this build', async () => {
    const list = query(templateQueries(deps), 'template.list')
    expect(await list({})).toEqual([starterTemplate])
  })
})

describe('template.slots [SPEC 4.3, FR-042]', () => {
  it("gives each starter slot of the campaign's master as filled or empty, with candidates", async () => {
    const slots = query(templateQueries(deps), 'template.slots')
    expect(await slots({ campaignId })).toEqual([
      { slot: { id: 'background', type: 'image' }, state: 'empty', candidates: [] },
      {
        slot: { id: 'subject-image', type: 'image' },
        state: 'filled',
        candidates: ['HERO2', 'HERO1'],
      },
      { slot: { id: 'logo', type: 'image' }, state: 'filled', candidates: ['LOGO'] },
      { slot: { id: 'headline', type: 'copy' }, state: 'filled', candidates: [] },
      { slot: { id: 'call-to-action', type: 'copy' }, state: 'empty', candidates: [] },
    ])
  })

  it('answers NOT_FOUND for a campaign the project does not hold', async () => {
    const slots = query(templateQueries(deps), 'template.slots')
    await expect(slots({ campaignId: 'x-222222' })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('refuses an input without a campaign with INVALID_INPUT', async () => {
    const slots = query(templateQueries(deps), 'template.slots')
    await expect(slots({})).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })
})

describe('project.get [SPEC 4.3]', () => {
  it('gives the meta, the subjects, campaign summaries with job marks, and the missing count', async () => {
    missing.push('HERO1', 'REF')
    bus.db
      .prepare(
        `INSERT INTO job (id, kind, status, campaign_id, request, created_at, updated_at)
         VALUES ('J1', 'image_generation', 'running', ?, '{}', 'x', 'x')`,
      )
      .run(campaignId)
    const get = query(projectQueries(deps), 'project.get')
    const result = (await get({})) as Record<string, unknown>
    expect(result.meta).toMatchObject({ projectId: bus.projectId, name: 'P' })
    expect(result.meta).not.toHaveProperty('assetsDirRel')
    expect(result.meta).not.toHaveProperty('assetsDirAbs')
    expect(result.subjects).toEqual([
      { id: 'bottle', name: 'Bottle', description: '', createdAt: '2026-11-20T10:00:00.000Z' },
      { id: 'can', name: 'Can', description: '', createdAt: '2026-11-20T10:00:00.000Z' },
    ])
    expect(result.campaigns).toEqual([
      {
        id: campaignId,
        name: 'Summer Splash!',
        region: 'US',
        primaryLanguage: 'en',
        createdBy: 'user',
        createdAt: '2026-11-20T10:00:00.000Z',
        jobRunning: true,
        resultUnseen: false,
        variantCount: 1,
      },
    ])
    expect(result.missingAssetCount).toBe(2)
  })

  it('answers NOT_FOUND for a project that is not open', async () => {
    const get = projectQueries(deps)['project.get']
    await expect(get?.({ projectId: 'nope' }, opts)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
