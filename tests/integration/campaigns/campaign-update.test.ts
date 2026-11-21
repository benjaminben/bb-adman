import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { expectRefused } from '../assets/asset-bus'
import { makeCampaignBus, type CampaignBus } from './campaign-fixture'

let bus: CampaignBus
let campaignId: string
beforeEach(async () => {
  bus = makeCampaignBus()
  const made = (await bus.create()) as { data: { campaignId: string } }
  campaignId = made.data.campaignId
})
afterEach(() => bus.cleanup())

const stored = () => bus.rows('campaign')[0]
const undo = (direction: 'undo' | 'redo') =>
  bus.bus.execute(
    `history.${direction}`,
    { projectId: bus.projectId, scope: `campaign:${campaignId}` },
    { actor: 'user' },
  )

describe('campaign.update [SPEC 4.2, FR-031]', () => {
  it('changes the fields it is given, trimmed where the brief trims, and names the row', async () => {
    const result = await bus.changed(() =>
      bus.user('campaign.update', {
        campaignId,
        name: ' Winter ',
        audience: 'Everyone',
        tone: 'Calm',
        offer: '2 for 1',
        callToAction: 'Shop',
      }),
    )
    expect(result).toEqual({ ok: true, data: { campaignId } })
    expect(stored()).toMatchObject({
      id: campaignId,
      name: 'Winter',
      audience: 'Everyone',
      tone: 'Calm',
      offer: '2 for 1',
      callToAction: 'Shop',
      message: 'Cool down this summer',
    })
  })

  it('clears an optional text with null', async () => {
    await bus.user('campaign.update', { campaignId, tone: 'Calm' })
    await bus.user('campaign.update', { campaignId, tone: null })
    expect(stored()).toMatchObject({ tone: null })
  })

  it("is undone and redone on the campaign's list", async () => {
    await bus.user('campaign.update', { campaignId, name: 'Winter', tone: 'Calm' })
    expect(await undo('undo')).toMatchObject({ ok: true })
    expect(stored()).toMatchObject({ name: 'Summer Splash!', tone: null })
    expect(await undo('redo')).toMatchObject({ ok: true })
    expect(stored()).toMatchObject({ name: 'Winter', tone: 'Calm' })
  })

  it('answers NOT_FOUND for a campaign the project does not hold', async () => {
    await expectRefused(
      bus,
      () => bus.user('campaign.update', { campaignId: 'x-222222', name: 'A' }),
      'NOT_FOUND',
    )
  })

  it.each([{ name: '  ' }, { audience: '' }, { languages: ['en'] }, { sizes: [] }])(
    'refuses %j with INVALID_INPUT',
    async (patch) => {
      await expectRefused(
        bus,
        () => bus.user('campaign.update', { campaignId, ...patch }),
        'INVALID_INPUT',
      )
    },
  )

  it('is denied to an agent', async () => {
    const result = await bus.bus.execute(
      'campaign.update',
      { projectId: bus.projectId, campaignId, name: 'A' },
      { actor: 'agent' },
    )
    expect(result).toMatchObject({ ok: false, error: { code: 'AGENT_DENIED' } })
  })
})
