// BB-8 (spec/brief-brand.md "One direction per subject"): with adsPer 'subject' and two or
// more subjects, campaign.create makes one direction per subject, each with its own master.
// Made-up names only.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { makeCampaignBus, createInput, insertImage, type CampaignBus } from './campaign-fixture'
import { briefSetUp, type BriefSetUp } from '../mcp/brief-tool-fixture'
import { replyJson } from '../mcp/tool-client'
import type { LayerRow } from '@/shared/schemas/rows/layer'

let bus: CampaignBus
beforeEach(() => {
  bus = makeCampaignBus()
})
afterEach(() => bus.cleanup())

type Row = Record<string, unknown>
type Made = { campaignId: string; directionId: string; variantId: string }

const perSubject = (extra: Record<string, unknown> = {}) => ({
  brief: { ...createInput().brief, adsPer: 'subject', ...extra },
})
const directions = () =>
  (bus.rows('direction') as Row[]).sort((a, b) => Number(a.sort) - Number(b.sort))
const variantOf = (directionId: unknown) =>
  (bus.rows('variant') as Row[]).filter((v) => v.directionId === directionId)
const subjectsOf = (variantId: unknown) =>
  (bus.rows('variant_subject') as Row[])
    .filter((s) => s.variantId === variantId)
    .map((s) => s.subjectId)
const heroOf = (variantId: unknown) =>
  (bus.rows('layer') as LayerRow[]).find(
    (l) => l.variantId === variantId && l.key === 'subject-image',
  )?.source ?? null

async function created(over: Record<string, unknown>): Promise<Made> {
  const reply = await bus.create(over)
  expect(reply).toMatchObject({ ok: true })
  return (reply as unknown as { data: Made }).data
}

describe('campaign.create adsPer subject [spec/brief-brand.md "One direction per subject", BB-8]', () => {
  it('makes one direction per subject, named after it, in subject order', async () => {
    await created(perSubject())
    expect(directions().map((d) => [d.name, d.sort])).toEqual([
      ['Can', 0],
      ['Bottle', 1],
    ])
  })

  it('gives each direction one master at the first size and primary language, with its subject alone', async () => {
    await created(perSubject())
    const [can, bottle] = directions()
    for (const [direction, subjectId] of [
      [can, 'can'],
      [bottle, 'bottle'],
    ] as const) {
      const variants = variantOf(direction?.id)
      expect(variants).toHaveLength(1)
      expect(variants[0]).toMatchObject({
        id: direction?.masterVariantId,
        sizeLabel: '1x1',
        language: 'en',
        title: subjectId,
      })
      expect(subjectsOf(variants[0]?.id)).toEqual([subjectId])
    }
  })

  it("fills each master's subject image with its own subject's hero", async () => {
    await bus.user('subject.create', { id: 'can', name: 'Can' })
    await bus.user('subject.create', { id: 'bottle', name: 'Bottle' })
    insertImage(bus, { id: 'CAN-HERO', subjectId: 'can' })
    insertImage(bus, { id: 'BOTTLE-HERO', subjectId: 'bottle' })
    const subjectMap = [
      { subjectId: 'can', create: false },
      { subjectId: 'bottle', create: false },
    ]
    await created({ ...perSubject(), subjectMap })
    const [can, bottle] = directions()
    expect(heroOf(can?.masterVariantId)).toEqual({ assetId: 'CAN-HERO' })
    expect(heroOf(bottle?.masterVariantId)).toEqual({ assetId: 'BOTTLE-HERO' })
  })

  it("leaves a subject with no hero without one, not the other subject's", async () => {
    await bus.user('subject.create', { id: 'can', name: 'Can' })
    insertImage(bus, { id: 'CAN-HERO', subjectId: 'can' })
    const subjectMap = [
      { subjectId: 'can', create: false },
      { subjectId: 'bottle', create: true },
    ]
    await created({ ...perSubject(), subjectMap })
    const [, bottle] = directions()
    expect(heroOf(bottle?.masterVariantId)).toBeNull()
  })

  it('places no hero when placeSubjectPhoto is false', async () => {
    await bus.user('subject.create', { id: 'can', name: 'Can' })
    insertImage(bus, { id: 'CAN-HERO', subjectId: 'can' })
    const subjectMap = [
      { subjectId: 'can', create: false },
      { subjectId: 'bottle', create: true },
    ]
    await created({ ...perSubject(), subjectMap, placeSubjectPhoto: false })
    expect(heroOf(directions()[0]?.masterVariantId)).toBeNull()
  })

  it('still lists every subject in campaign_subject', async () => {
    await created(perSubject())
    expect((bus.rows('campaign_subject') as Row[]).map((r) => r.subjectId).sort()).toEqual([
      'bottle',
      'can',
    ])
  })

  it('names the first direction and its master in the reply', async () => {
    const made = await created(perSubject())
    const [first] = directions()
    expect(made.directionId).toBe(first?.id)
    expect(made.variantId).toBe(first?.masterVariantId)
  })

  it("uses an existing subject's stored name, trimmed", async () => {
    await bus.user('subject.create', { id: 'can', name: 'Stored can' })
    const subjectMap = [
      { subjectId: 'can', create: false },
      { subjectId: 'bottle', create: true },
    ]
    await created({ ...perSubject(), subjectMap })
    expect(directions()[0]?.name).toBe('Stored can')
  })

  it('cuts a subject name of 150 letters to 100', async () => {
    const long = 'a'.repeat(150)
    const subjects = [{ name: long }, { name: 'Bottle' }]
    await created(perSubject({ subjects }))
    expect(directions()[0]?.name).toBe('a'.repeat(100))
  })
})

describe('campaign.create with one set of ads [BB-8]', () => {
  it('makes one "Direction 1" for one subject with adsPer subject', async () => {
    const subjects = [{ name: 'Can' }]
    const subjectMap = [{ subjectId: 'can', create: true }]
    await created({ ...perSubject({ subjects }), subjectMap })
    expect(directions().map((d) => d.name)).toEqual(['Direction 1'])
  })

  it('makes one "Direction 1" holding both subjects with adsPer campaign', async () => {
    await created({ brief: { ...createInput().brief, adsPer: 'campaign' } })
    expect(directions().map((d) => d.name)).toEqual(['Direction 1'])
    expect(subjectsOf(directions()[0]?.masterVariantId).sort()).toEqual(['bottle', 'can'])
  })
})

describe('create_campaign_from_brief with adsPer subject [BB-8]', () => {
  let x: BriefSetUp | undefined
  afterEach(async () => {
    await x?.close()
    x = undefined
  })

  it('makes one direction per subject, each master with its own photo', async () => {
    x = await briefSetUp()
    const mug = await x.png('mug.png', 2)
    const flask = await x.png('flask.png', 3)
    const brief = JSON.stringify({
      campaignName: 'Harbour Roast',
      region: 'US',
      audience: 'Morning commuters',
      message: 'Wake up warm',
      adsPer: 'subject',
      subjects: [
        { name: 'Travel mug', pictures: [mug] },
        { name: 'Flask', pictures: [flask] },
      ],
    })
    const reply = await x.tool(brief)
    expect(reply.isError).toBeFalsy()
    const made = replyJson<Made>(reply)
    const rows = x.rows(
      `SELECT name, master_variant_id FROM direction WHERE campaign_id = '${made.campaignId}'
       ORDER BY sort`,
    )
    expect(rows.map((r) => r.name)).toEqual(['Travel mug', 'Flask'])
    expect(made.variantId).toBe(rows[0]?.master_variant_id)
    const hero = (variantId: unknown) =>
      String(
        x?.rows(
          `SELECT source FROM layer WHERE variant_id = '${String(variantId)}'
           AND key = 'subject-image'`,
        )[0]?.source,
      )
    expect(hero(rows[0]?.master_variant_id)).toContain(mug)
    expect(hero(rows[1]?.master_variant_id)).toContain(flask)
  })
})
