import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { expectRefused } from '../assets/asset-bus'
import { makeCampaignBus, createInput, SQUARE, TALL, type CampaignBus } from './campaign-fixture'
import { TEST_NOW } from './campaign-deps'
import type { LayerRow } from '@/shared/schemas/rows/layer'

let bus: CampaignBus
beforeEach(() => {
  bus = makeCampaignBus()
})
afterEach(() => bus.cleanup())

type Created = { campaignId: string; directionId: string; variantId: string }
async function created(over: Record<string, unknown> = {}): Promise<Created> {
  const result = (await bus.create(over)) as { ok: boolean; data: Created; error?: unknown }
  if (!result.ok) throw new Error(JSON.stringify(result.error))
  return result.data
}

describe('campaign.create [SPEC 4.2, 6.1, FR-023 to FR-026]', () => {
  it('writes the campaign and names every row it wrote', async () => {
    const result = (await bus.changed(() => bus.create())) as { ok: boolean; data: Created }
    expect(result.ok).toBe(true)
    expect(result.data.campaignId).toMatch(/^summer-splash-[23456789abcdefghjkmnpqrstuvwxyz]{6}$/)
    expect(result.data.variantId).toMatch(/^[23456789abcdefghjkmnpqrstuvwxyz]{6}$/)
  })

  it('stores the campaign from the trimmed brief, its languages and sizes', async () => {
    const { campaignId } = await created()
    expect(bus.rows('campaign')).toEqual([
      {
        id: campaignId,
        name: 'Summer Splash!',
        region: 'US',
        audience: 'Families',
        message: 'Cool down this summer',
        offer: null,
        callToAction: null,
        tone: null,
        primaryLanguage: 'en',
        languages: ['en', 'de'],
        sizes: [SQUARE, TALL],
        templateId: 'starter',
        brief: { ...createInput().brief, message: 'Cool down this summer' },
        createdBy: 'user',
        createdAt: TEST_NOW,
      },
    ])
    expect(bus.rows('campaign_subject')).toEqual([
      { campaignId, subjectId: 'can' },
      { campaignId, subjectId: 'bottle' },
    ])
  })

  it('makes the subjects the map asks for, from the brief entries', async () => {
    await created()
    expect(bus.rows('subject')).toEqual([
      { id: 'can', name: 'Can', description: 'A red can', createdAt: TEST_NOW },
      { id: 'bottle', name: 'Bottle', description: '', createdAt: TEST_NOW },
    ])
  })

  it('uses an existing subject for create: false', async () => {
    await bus.user('subject.create', { id: 'old', name: 'Old' })
    const { campaignId } = await created({
      subjectMap: [
        { subjectId: 'old', create: false },
        { subjectId: 'bottle', create: true },
      ],
    })
    expect(bus.rows('campaign_subject')).toContainEqual({ campaignId, subjectId: 'old' })
    expect(bus.rows('subject')).toHaveLength(2)
  })

  it("holds the brief's word lists in the rule set, a plain list under the primary language [R-03]", async () => {
    const { campaignId } = await created()
    expect(bus.rows('rule_set')).toEqual([
      {
        campaignId,
        requiredAssetIds: [],
        palette: [],
        requiredWords: { en: ['fresh'] },
        prohibitedWords: { en: ['cheap'], de: ['billig'] },
      },
    ])
  })

  it('makes one direction named "Direction 1" and one master variant at the first size', async () => {
    const { campaignId, directionId, variantId } = await created()
    expect(bus.rows('direction')).toEqual([
      { id: directionId, campaignId, name: 'Direction 1', masterVariantId: variantId, sort: 0 },
    ])
    expect(bus.rows('variant')).toEqual([
      {
        id: variantId,
        directionId,
        title: 'can+bottle',
        width: 1080,
        height: 1080,
        sizeLabel: '1x1',
        language: 'en',
        format: 'image',
        durationMs: 6000,
        durationOverridden: false,
        rev: 0,
        createdBy: 'user',
        createdAt: TEST_NOW,
        agentChangedAt: null,
      },
    ])
    expect(bus.rows('variant_subject')).toEqual([
      { variantId, subjectId: 'can' },
      { variantId, subjectId: 'bottle' },
    ])
  })

  it('gives the master a background layer and a headline with the message word for word [FR-043]', async () => {
    const { variantId } = await created()
    const layers = (bus.rows('layer') as LayerRow[]).sort((a, b) => a.z - b.z)
    expect(layers.map((l) => [l.key, l.type, l.z, l.variantId])).toEqual([
      ['background', 'background', 0, variantId],
      ['headline', 'text', 1, variantId],
    ])
    expect(layers[0]?.source).toBeNull()
    expect(layers[1]?.copy).toBe('Cool down this summer')
    expect(layers.every((l) => /^[0-9A-HJKMNP-TV-Z]{26}$/.test(l.id))).toBe(true)
  })

  it('adds a call-to-action layer when the brief has one', async () => {
    const input = createInput()
    await created({ brief: { ...input.brief, callToAction: 'Buy now' } })
    const cta = (bus.rows('layer') as LayerRow[]).find((l) => l.key === 'call-to-action')
    expect(cta?.copy).toBe('Buy now')
  })

  it("records an agent's campaign as created by the agent", async () => {
    const result = await bus.bus.execute(
      'campaign.create',
      { projectId: bus.projectId, ...createInput() },
      { actor: 'agent' },
    )
    expect(result.ok).toBe(true)
    expect(bus.rows('campaign')[0]?.createdBy).toBe('agent')
    expect(bus.rows('variant')[0]).toMatchObject({ createdBy: 'agent', agentChangedAt: null })
  })

  it('is not undoable [D-010]', async () => {
    const { campaignId } = await created()
    expect(bus.undo.state(bus.projectId, `campaign:${campaignId}`)).toEqual({
      canUndo: false,
      canRedo: false,
    })
  })
})

describe('campaign.create refusals [SPEC 6.1]', () => {
  it('refuses a subject ID that is taken, for create: true', async () => {
    await bus.user('subject.create', { id: 'can', name: 'Can' })
    await expectRefused(bus, () => bus.create(), 'RULE_VIOLATION')
  })

  it('answers NOT_FOUND for create: false with no such subject', async () => {
    const subjectMap = [
      { subjectId: 'ghost', create: false },
      { subjectId: 'bottle', create: true },
    ]
    await expectRefused(bus, () => bus.create({ subjectMap }), 'NOT_FOUND')
  })

  it('refuses a new subject ID outside the SPEC 3.2 format', async () => {
    const subjectMap = [
      { subjectId: 'has space', create: true },
      { subjectId: 'bottle', create: true },
    ]
    await expectRefused(bus, () => bus.create({ subjectMap }), 'INVALID_INPUT')
  })

  it('refuses a wrong number of subject entries', async () => {
    const subjectMap = [{ subjectId: 'can', create: true }]
    await expectRefused(bus, () => bus.create({ subjectMap }), 'INVALID_INPUT')
  })

  it.each([['ar'], ['en', 'he-IL'], ['fa_IR']])(
    'refuses the right-to-left languages %j [FR-104]',
    async (...languages) => {
      const error = await expectRefused(bus, () => bus.create({ languages }), 'RULE_VIOLATION')
      expect(error.message).toBe('Right-to-left languages are not supported yet.')
    },
  )

  it('answers NOT_FOUND for a template the build does not have', async () => {
    await expectRefused(bus, () => bus.create({ templateId: 'fancy' }), 'NOT_FOUND')
  })
})

// SP-1 review Note 5 [D-098]: a picture path given to campaign.create is never stored.
describe('campaign.create drops subject pictures [D-098]', () => {
  it('stores a brief whose subjects have no pictures key', async () => {
    const input = createInput()
    const subjects = input.brief.subjects.map((s) => ({ ...s, pictures: ['/private/secret.png'] }))
    const result = (await bus.create({ brief: { ...input.brief, subjects } })) as { ok: boolean }
    expect(result.ok).toBe(true)
    const [row] = bus.rows('campaign') as Array<{ brief: { subjects: object[] } }>
    for (const subject of row?.brief.subjects ?? []) expect(subject).not.toHaveProperty('pictures')
    expect(row?.brief.subjects).toHaveLength(2)
    expect(JSON.stringify(bus.rows('campaign'))).not.toContain('secret')
  })
})
