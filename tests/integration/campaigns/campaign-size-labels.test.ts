import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { expectRefused } from '../assets/asset-bus'
import { makeCampaignBus, SQUARE, type CampaignBus } from './campaign-fixture'

// LP-4: a size's label is the ready-made label for its pixels or exactly "{width}x{height}".

let bus: CampaignBus
beforeEach(() => {
  bus = makeCampaignBus()
})
afterEach(() => bus.cleanup())

const mismatched = [
  { label: '1x1', width: 1080, height: 1920 },
  { label: '1080x1080', width: 1080, height: 1920 },
]
const fitting = [
  { label: '1x1', width: 1080, height: 1080 },
  { label: '1080x1080', width: 1080, height: 1080 },
  { label: '700x500', width: 700, height: 500 },
]

describe('size labels match their pixels [LP-4]', () => {
  it.each(mismatched)('campaign.create refuses %j with INVALID_INPUT', async (size) => {
    await expectRefused(bus, () => bus.create({ sizes: [size] }), 'INVALID_INPUT')
  })

  it.each(fitting)('campaign.create takes %j', async (size) => {
    const result = await bus.create({ sizes: [size] })
    expect(result).toMatchObject({ ok: true })
  })

  // The first variant is 1x1, so each new list keeps that size.
  it.each([
    { label: '9x16', width: 1080, height: 1350 },
    { label: '1080x1080', width: 1080, height: 1920 },
  ])('campaign.update refuses %j beside 1x1 with INVALID_INPUT', async (size) => {
    const made = (await bus.create()) as { data: { campaignId: string } }
    const { campaignId } = made.data
    await expectRefused(
      bus,
      () => bus.user('campaign.update', { campaignId, sizes: [SQUARE, size] }),
      'INVALID_INPUT',
    )
  })

  it.each([...fitting.slice(1), { label: '9x16', width: 1080, height: 1920 }])(
    'campaign.update takes %j beside 1x1',
    async (size) => {
      const made = (await bus.create()) as { data: { campaignId: string } }
      const { campaignId } = made.data
      const result = await bus.user('campaign.update', { campaignId, sizes: [SQUARE, size] })
      expect(result).toMatchObject({ ok: true })
    },
  )
})
