import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { makeCampaignBus, type CampaignBus } from './campaign-fixture'
import { testDeps } from './campaign-deps'
import { campaignQueries } from '../../../src/main/queries/campaign'
import type { CoreDeps } from '../../../src/main/core-deps'
import type { CampaignGet } from '../../../src/shared/schemas/queries/campaign'

let bus: CampaignBus
let deps: CoreDeps
let campaignId: string
let variantId: string
const opts = { actor: 'user' as const }
const missing: string[] = []

const NO_BADGES = {
  jobRunning: false,
  resultUnseen: false,
  outOfDate: false,
  overflow: false,
  translationUnapproved: false,
  checkWarning: false,
  checkStale: false,
  missingFile: false,
}

beforeEach(async () => {
  bus = makeCampaignBus()
  missing.length = 0
  deps = testDeps({
    projects: bus.projects,
    assets: { missingAssetIds: async () => [...missing] } as unknown as CoreDeps['assets'],
  })
  const made = (await bus.create()) as { data: { campaignId: string; variantId: string } }
  campaignId = made.data.campaignId
  variantId = made.data.variantId
})
afterEach(() => bus.cleanup())

const get = async (input: Record<string, unknown> = { campaignId }) =>
  (await campaignQueries(deps)['campaign.get']?.({ projectId: bus.projectId, ...input }, opts)) as
    CampaignGet | undefined

const setLayer = (key: string, sql: string, ...values: unknown[]) =>
  bus.db
    .prepare(`UPDATE layer SET ${sql} WHERE variant_id = ? AND key = ?`)
    .run(...values, variantId, key)

const addJob = (id: string, status: string, column: 'campaign_id' | 'variant_id', value: string) =>
  bus.db
    .prepare(
      `INSERT INTO job (id, kind, status, ${column}, request, created_at, updated_at)
       VALUES (?, 'image_generation', ?, ?, '{}', 'x', 'x')`,
    )
    .run(id, status, value)

const firstVariant = async () => (await get())?.variants[0]

describe('campaign.get [SPEC 4.3 1.42, C4-1]', () => {
  it('gives the campaign, its subjects, rule set, one direction and one master with no badges', async () => {
    const result = await get()
    expect(result?.campaign).toEqual(bus.rows('campaign')[0])
    expect(result?.subjects.map((s) => s.id)).toEqual(['bottle', 'can'])
    expect(result?.ruleSet).toEqual(bus.rows('rule_set')[0])
    expect(result?.directions).toEqual(bus.rows('direction'))
    expect(result?.variants).toEqual([
      {
        ...bus.rows('variant')[0],
        isMaster: true,
        subjectIds: ['bottle', 'can'],
        badges: NO_BADGES,
      },
    ])
    expect(result?.marks).toEqual({ jobRunning: false, resultUnseen: false })
  })

  it('sets overflow when a layer of the variant overflows', async () => {
    setLayer('headline', 'overflow = 1')
    expect((await firstVariant())?.badges).toEqual({ ...NO_BADGES, overflow: true })
  })

  it('sets translationUnapproved when a layer has a proposed translation', async () => {
    setLayer('headline', "translation_status = 'proposed'")
    expect((await firstVariant())?.badges).toEqual({ ...NO_BADGES, translationUnapproved: true })
  })

  it('sets missingFile when a layer source is in the missing list, and not for a null source', async () => {
    missing.push('GONE')
    setLayer('background', 'source = NULL')
    expect((await firstVariant())?.badges.missingFile).toBe(false)
    setLayer('background', 'source = ?', JSON.stringify({ assetId: 'GONE' }))
    expect((await firstVariant())?.badges).toEqual({ ...NO_BADGES, missingFile: true })
  })

  it("sets the variant's jobRunning and the campaign's mark for a running job of the variant", async () => {
    addJob('J1', 'running', 'variant_id', variantId)
    addJob('J2', 'running', 'campaign_id', campaignId)
    const result = await get()
    expect(result?.variants[0]?.badges).toEqual({ ...NO_BADGES, jobRunning: true })
    expect(result?.marks).toEqual({ jobRunning: true, resultUnseen: false })
  })

  it('sets resultUnseen for a succeeded job not yet seen', async () => {
    addJob('J1', 'succeeded', 'variant_id', variantId)
    expect((await firstVariant())?.badges).toEqual({ ...NO_BADGES, resultUnseen: true })
  })

  it('keeps checkWarning, checkStale and outOfDate false in Phase 2', async () => {
    setLayer('headline', 'overflow = 1')
    const badges = (await firstVariant())?.badges
    expect(badges).toMatchObject({ checkWarning: false, checkStale: false, outOfDate: false })
  })

  it('answers NOT_FOUND for a campaign the project does not hold', async () => {
    await expect(get({ campaignId: 'x-222222' })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('refuses an input without a campaign with INVALID_INPUT', async () => {
    await expect(get({})).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })

  it('writes nothing to the project file', async () => {
    addJob('J1', 'succeeded', 'variant_id', variantId)
    const tables = ['campaign', 'direction', 'variant', 'layer', 'job', 'subject'] as const
    const counts = () => tables.map((t) => bus.rows(t).length)
    const before = counts()
    const jobs = bus.rows('job')
    await get()
    expect(counts()).toEqual(before)
    expect(bus.rows('job')).toEqual(jobs)
  })
})
