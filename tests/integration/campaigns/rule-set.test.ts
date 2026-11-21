import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { expectRefused } from '../assets/asset-bus'
import { makeCampaignBus, insertImage, type CampaignBus } from './campaign-fixture'

let bus: CampaignBus
let a: string
let b: string

beforeEach(async () => {
  bus = makeCampaignBus()
  a = ((await bus.create()) as { data: { campaignId: string } }).data.campaignId
  const subjectMap = [
    { subjectId: 'can', create: false },
    { subjectId: 'bottle', create: false },
  ]
  b = ((await bus.create({ subjectMap })) as { data: { campaignId: string } }).data.campaignId
})
afterEach(() => bus.cleanup())

const ruleSetOf = (campaignId: string) =>
  bus.rows('rule_set').find((r) => r.campaignId === campaignId)
const history = (direction: 'undo' | 'redo', campaignId: string) =>
  bus.bus.execute(
    `history.${direction}`,
    { projectId: bus.projectId, scope: `campaign:${campaignId}` },
    { actor: 'user' },
  )

describe('ruleSet.update [SPEC 4.2, FR-033]', () => {
  it('replaces the lists it is given and names the row', async () => {
    insertImage(bus, { id: 'LOGO' })
    const result = await bus.changed(() =>
      bus.user('ruleSet.update', {
        campaignId: a,
        requiredAssetIds: ['LOGO'],
        palette: ['#0A0B0C'],
      }),
    )
    expect(result).toEqual({ ok: true, data: { campaignId: a } })
    expect(ruleSetOf(a)).toEqual({
      campaignId: a,
      requiredAssetIds: ['LOGO'],
      palette: ['#0A0B0C'],
      requiredWords: { en: ['fresh'] },
      prohibitedWords: { en: ['cheap'], de: ['billig'] },
    })
  })

  it("is undone and redone on the campaign's list", async () => {
    await bus.user('ruleSet.update', { campaignId: a, requiredWords: { en: ['cool'] } })
    expect(await history('undo', a)).toMatchObject({ ok: true })
    expect(ruleSetOf(a)).toMatchObject({ requiredWords: { en: ['fresh'] } })
    expect(await history('redo', a)).toMatchObject({ ok: true })
    expect(ruleSetOf(a)).toMatchObject({ requiredWords: { en: ['cool'] } })
  })

  it('answers NOT_FOUND for a required asset the project does not hold', async () => {
    await expectRefused(
      bus,
      () => bus.user('ruleSet.update', { campaignId: a, requiredAssetIds: ['GHOST'] }),
      'NOT_FOUND',
    )
  })

  it('answers NOT_FOUND for a campaign the project does not hold', async () => {
    await expectRefused(
      bus,
      () => bus.user('ruleSet.update', { campaignId: 'x-222222', palette: [] }),
      'NOT_FOUND',
    )
  })

  it('refuses a colour that is not #RRGGBB', async () => {
    await expectRefused(
      bus,
      () => bus.user('ruleSet.update', { campaignId: a, palette: ['red'] }),
      'INVALID_INPUT',
    )
  })
})

describe('ruleSet.copyFrom [SPEC 4.2, 3.3, FR-034]', () => {
  it("copies the four lists of the source campaign's rule set", async () => {
    insertImage(bus, { id: 'LOGO' })
    await bus.user('ruleSet.update', {
      campaignId: a,
      requiredAssetIds: ['LOGO'],
      palette: ['#FFFFFF'],
      requiredWords: { de: ['frisch'] },
      prohibitedWords: {},
    })
    const result = await bus.changed(() =>
      bus.user('ruleSet.copyFrom', { campaignId: b, sourceCampaignId: a }),
    )
    expect(result).toEqual({ ok: true, data: { campaignId: b } })
    expect(ruleSetOf(b)).toEqual({ ...ruleSetOf(a), campaignId: b })
  })

  it("is undone on the target campaign's list", async () => {
    const was = ruleSetOf(b)
    await bus.user('ruleSet.update', { campaignId: a, palette: ['#123456'] })
    await bus.user('ruleSet.copyFrom', { campaignId: b, sourceCampaignId: a })
    expect(await history('undo', b)).toMatchObject({ ok: true })
    expect(ruleSetOf(b)).toEqual(was)
  })

  it('answers NOT_FOUND when either campaign is not in this project', async () => {
    await expectRefused(
      bus,
      () => bus.user('ruleSet.copyFrom', { campaignId: b, sourceCampaignId: 'x-222222' }),
      'NOT_FOUND',
    )
    await expectRefused(
      bus,
      () => bus.user('ruleSet.copyFrom', { campaignId: 'x-222222', sourceCampaignId: a }),
      'NOT_FOUND',
    )
  })
})
