import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { expectRefused } from '../assets/asset-bus'
import { makeCampaignBus, createInput, insertImage, type CampaignBus } from './campaign-fixture'
import { makeFixture, data, type Fixture } from '../core-fixture'
import { Brief, type BriefDraft } from '@/shared/schemas/brief'
import { parseSize } from '@/shared/brief/size'
import { readWireRows } from '@/main/db/rows'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { testDeps } from './campaign-deps'
import { templateQueries } from '@/main/queries/template'
import type { CoreDeps } from '@/main/core-deps'

let bus: CampaignBus
beforeEach(() => {
  bus = makeCampaignBus()
})
afterEach(() => bus.cleanup())

const layerByKey = (key: string) =>
  (bus.rows('layer') as LayerRow[]).find((l) => l.key === key) ?? null
const ruleSet = {
  requiredAssetIds: [] as string[],
  palette: [],
  requiredWords: {},
  prohibitedWords: {},
}

describe('campaign.create slot fills [SPEC 6.1 starter template, R-12]', () => {
  it("fills the subject image with the first subject's newest hero image", async () => {
    await bus.user('subject.create', { id: 'can', name: 'Can' })
    insertImage(bus, { id: 'OLD', subjectId: 'can', createdAt: '2026-01-01T00:00:00.000Z' })
    insertImage(bus, { id: 'NEW', subjectId: 'can', createdAt: '2026-02-01T00:00:00.000Z' })
    insertImage(bus, { id: 'REF', subjectId: 'can', library: 'reference' })
    const subjectMap = [
      { subjectId: 'can', create: false },
      { subjectId: 'bottle', create: true },
    ]
    expect(await bus.create({ subjectMap })).toMatchObject({ ok: true })
    expect(layerByKey('subject-image')).toMatchObject({ type: 'image', source: { assetId: 'NEW' } })
  })

  it('leaves the subject image out when only reference files exist', async () => {
    await bus.user('subject.create', { id: 'can', name: 'Can' })
    insertImage(bus, { id: 'REF', subjectId: 'can', library: 'reference' })
    const subjectMap = [
      { subjectId: 'can', create: false },
      { subjectId: 'bottle', create: true },
    ]
    await bus.create({ subjectMap })
    expect(layerByKey('subject-image')).toBeNull()
  })

  it("fills the logo with the first image among the rule set's required assets", async () => {
    insertImage(bus, { id: 'FONT', kind: 'font' })
    insertImage(bus, { id: 'LOGO' })
    const result = await bus.create({ ruleSet: { ...ruleSet, requiredAssetIds: ['FONT', 'LOGO'] } })
    expect(result).toMatchObject({ ok: true })
    expect(layerByKey('logo')).toMatchObject({ source: { assetId: 'LOGO' } })
    expect(bus.rows('rule_set')[0]).toMatchObject({ requiredAssetIds: ['FONT', 'LOGO'] })
  })
})

describe('campaign.create placeSubjectPhoto [spec/subject-photos.md, SP-6]', () => {
  const heroFirst = async () => {
    await bus.user('subject.create', { id: 'can', name: 'Can' })
    insertImage(bus, { id: 'HERO', subjectId: 'can' })
    return [
      { subjectId: 'can', create: false },
      { subjectId: 'bottle', create: true },
    ]
  }
  const slotsOf = async (campaignId: string) => {
    const deps = testDeps({
      projects: bus.projects,
      assets: { missingAssetIds: async () => [] } as unknown as CoreDeps['assets'],
    })
    const slots = templateQueries(deps)['template.slots']
    return (await slots?.({ projectId: bus.projectId, campaignId }, { actor: 'user' })) as {
      slot: { id: string }
      state: string
      candidates: string[]
    }[]
  }

  it.each([
    { name: 'false', over: { placeSubjectPhoto: false }, filled: false },
    { name: 'true', over: { placeSubjectPhoto: true }, filled: true },
    { name: 'left out', over: {}, filled: true },
  ])('$name: the subject image is filled: $filled; the hero stays a candidate', async (c) => {
    const subjectMap = await heroFirst()
    const made = (await bus.create({ subjectMap, ...c.over })) as {
      ok: boolean
      data: { campaignId: string }
    }
    expect(made.ok).toBe(true)
    const layer = layerByKey('subject-image')
    if (c.filled) expect(layer).toMatchObject({ source: { assetId: 'HERO' } })
    else expect(layer).toBeNull()
    const slot = (await slotsOf(made.data.campaignId)).find((s) => s.slot.id === 'subject-image')
    expect(slot).toMatchObject({ state: c.filled ? 'filled' : 'empty', candidates: ['HERO'] })
  })
})

describe('campaign.create rule set [SPEC 6.1, FR-033, FR-034]', () => {
  it('stores a given rule set as given', async () => {
    const given = { ...ruleSet, palette: ['#112233'], requiredWords: { de: ['frisch'] } }
    await bus.create({ ruleSet: given })
    expect(bus.rows('rule_set')[0]).toMatchObject(given)
  })

  it("copies another campaign's rule set with copyRuleSetFrom", async () => {
    insertImage(bus, { id: 'LOGO' })
    const first = (await bus.create({
      ruleSet: { ...ruleSet, requiredAssetIds: ['LOGO'], palette: ['#AABBCC'] },
    })) as { data: { campaignId: string } }
    const subjectMap = [
      { subjectId: 'can', create: false },
      { subjectId: 'bottle', create: false },
    ]
    const second = (await bus.create({
      subjectMap,
      copyRuleSetFrom: first.data.campaignId,
    })) as { ok: boolean; data: { campaignId: string } }
    expect(second.ok).toBe(true)
    const copied = bus.rows('rule_set').find((r) => r.campaignId === second.data.campaignId)
    expect(copied).toMatchObject({ requiredAssetIds: ['LOGO'], palette: ['#AABBCC'] })
  })

  it('answers NOT_FOUND for copyRuleSetFrom naming no campaign', async () => {
    await expectRefused(bus, () => bus.create({ copyRuleSetFrom: 'nope-222222' }), 'NOT_FOUND')
  })

  it('answers NOT_FOUND for a required asset the project does not hold', async () => {
    const given = { ...ruleSet, requiredAssetIds: ['GHOST'] }
    await expectRefused(bus, () => bus.create({ ruleSet: given }), 'NOT_FOUND')
  })

  it('refuses both a rule set and copyRuleSetFrom', async () => {
    await expectRefused(
      bus,
      () => bus.create({ ruleSet, copyRuleSetFrom: 'x-222222' }),
      'INVALID_INPUT',
    )
  })

  it('keeps a campaign name with no plain letters as campaign-{code}', async () => {
    const input = createInput()
    const result = (await bus.create({ brief: { ...input.brief, campaignName: '夏' } })) as {
      data: { campaignId: string }
    }
    expect(result.data.campaignId).toMatch(/^campaign-[23456789a-z]{6}$/)
  })
})

describe('Phase 2 exit: examples/brief.yaml becomes a campaign [SPEC 14 Phase 2]', () => {
  let f: Fixture
  afterEach(() => f.cleanup())

  it("gives a master whose headline is the brief's message word for word [FR-043]", async () => {
    f = makeFixture()
    const { projectId } = data<{ projectId: string }>(
      await f.user('project.create', { name: 'Example', location: f.projectsDir }),
    )
    const filePath = path.resolve(__dirname, '../../../examples/brief.yaml')
    const { draft, primaryLanguage } = data<{ draft: BriefDraft; primaryLanguage: string }>(
      await f.user('brief.parse', { projectId, filePath }),
    )
    const brief = Brief.parse(draft)
    expect(brief.subjects).toHaveLength(2)
    const made = await f.user('campaign.create', {
      projectId,
      brief,
      subjectMap: brief.subjects.map((s) => ({ subjectId: s.id, create: true })),
      languages: draft.languages ?? [primaryLanguage],
      sizes: (draft.sizes ?? []).map((s) => parseSize(s)),
      templateId: 'starter',
    })
    const { variantId } = data<{ variantId: string }>(made)
    const project = f.core.deps.projects.requireOpen(projectId)
    const headline = (readWireRows(project.db, 'layer') as LayerRow[]).find(
      (l) => l.variantId === variantId && l.key === 'headline',
    )
    expect(headline?.copy).toBe(draft.message)
    expect(headline?.copy).toBe('Cool down with every sip')
  })
})
