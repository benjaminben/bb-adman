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

  it.each([{ name: '  ' }, { audience: '' }, { languages: [] }, { sizes: [] }, { region: 'US' }])(
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

describe('campaign.update with languages and sizes [SPEC 4.2 1.42, FR-031, FR-032, C4-3]', () => {
  const update = (patch: Record<string, unknown>) =>
    bus.user('campaign.update', { campaignId, ...patch })
  // The two sizes of the fixture's campaign.create input; the master is the first.
  const SQUARE = { label: '1x1', width: 1080, height: 1080 }
  const TALL = { label: '9x16', width: 1080, height: 1920 }
  const WIDE = { label: '16x9', width: 1920, height: 1080 }

  it('stores a languages list that holds the primary language, and keeps the master', async () => {
    const master = bus.rows('variant')
    expect(await update({ languages: ['fr', 'en'] })).toMatchObject({ ok: true })
    expect(stored()).toMatchObject({ languages: ['fr', 'en'], primaryLanguage: 'en' })
    expect(bus.rows('variant')).toEqual(master)
  })

  it('refuses a languages list without the primary language with RULE_VIOLATION', async () => {
    const error = await expectRefused(bus, () => update({ languages: ['de'] }), 'RULE_VIOLATION')
    expect(error.message).toBe("The campaign's first language cannot be removed.")
    expect(error.details?.reason).toBeUndefined()
  })

  it('refuses a languages list with a right-to-left language with RULE_VIOLATION', async () => {
    await expectRefused(bus, () => update({ languages: ['en', 'ar'] }), 'RULE_VIOLATION')
  })

  it("stores a sizes list that holds the master's size", async () => {
    expect(await update({ sizes: [WIDE, SQUARE] })).toMatchObject({ ok: true })
    expect(stored()).toMatchObject({ sizes: [WIDE, SQUARE] })
  })

  it("refuses a sizes list without the master's label with RULE_VIOLATION", async () => {
    const error = await expectRefused(bus, () => update({ sizes: [TALL] }), 'RULE_VIOLATION')
    expect(error.message).toBe('The size of the master cannot be removed or changed.')
    expect(error.details?.reason).toBeUndefined()
  })

  it("refuses the master's label with another width with RULE_VIOLATION", async () => {
    const changed = { ...SQUARE, width: 1200 }
    await expectRefused(bus, () => update({ sizes: [changed, TALL] }), 'RULE_VIOLATION')
  })

  it('puts both lists back on undo', async () => {
    await update({ languages: ['en'], sizes: [SQUARE] })
    expect(await undo('undo')).toMatchObject({ ok: true })
    expect(stored()).toMatchObject({ languages: ['en', 'de'], sizes: [SQUARE, TALL] })
  })

  it('leaves the stored brief as it was', async () => {
    const brief = stored()?.brief
    expect(await update({ languages: ['en', 'fr'], sizes: [SQUARE, WIDE] })).toMatchObject({
      ok: true,
    })
    expect(stored()?.brief).toEqual(brief)
  })

  it('adds and removes no variant', async () => {
    const variants = bus.rows('variant')
    const layers = bus.rows('layer')
    const grow = await update({ languages: ['en', 'fr', 'it'], sizes: [SQUARE, TALL, WIDE] })
    const shrink = await update({ languages: ['en'], sizes: [SQUARE] })
    expect([grow, shrink]).toMatchObject([{ ok: true }, { ok: true }])
    expect(bus.rows('variant')).toEqual(variants)
    expect(bus.rows('layer')).toEqual(layers)
  })
})
