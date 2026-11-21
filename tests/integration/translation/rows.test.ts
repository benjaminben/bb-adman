// P6-7 (spec/phases/phase-06.md, design addition 1): translation.forCampaign answers every text
// layer of the campaign's posts not in the primary language, and the newest translation job
// per direction and language.
import { describe, it, expect, afterEach } from 'vitest'
import { data } from '../core-fixture'
import { createInput } from '../campaigns/campaign-fixture'
import { insertJob } from '../queries/job-row-fixture'
import { makeRowsSetup, type RowsSetup } from './rows-fixture'
import type { TranslationForCampaign } from '@/shared/schemas/queries/translation'

let s: RowsSetup | undefined
afterEach(() => {
  s?.fx.cleanup()
  s = undefined
})

async function setup() {
  s = await makeRowsSetup()
  return s
}

async function ask(t: RowsSetup, actor: 'user' | 'agent' = 'user', campaignId = t.campaignId) {
  const input = { projectId: t.projectId, campaignId }
  return data<TranslationForCampaign>(
    await t.fx.core.query('translation.forCampaign', input, { actor }),
  )
}

const request = (directionId: string, to: string) =>
  JSON.stringify({
    mode: 'write',
    directionId,
    from: 'en',
    to,
    region: 'US',
    audience: 'Families',
    items: [],
    targets: [],
  })

describe('translation.forCampaign [P6-7]', () => {
  it('orders the rows by direction, language, size label and layer z', async () => {
    const t = await setup()
    const { de1, de9, de2 } = t.variants
    const expected = [
      ...[de1, de9].flatMap((v) => t.textLayers(v).map((l) => [t.directions[0], v, l.key])),
      ...t.textLayers(de2).map((l) => [t.directions[1], de2, l.key]),
    ]
    const reply = await ask(t)
    expect(reply.primaryLanguage).toBe('en')
    expect(reply.rows.map((r) => [r.directionId, r.variantId, r.layerKey])).toEqual(expected)
    expect(expected).toHaveLength(3)
  })

  it("gives each row the master's copy as source text and the layer's own fields", async () => {
    const t = await setup()
    const master = t.textLayers(t.masters[0])[0]
    const layer = t.textLayers(t.variants.de1)[0]
    if (!master || !layer) throw new Error('no text layer')
    t.setCopy(master.id, 'Shop now')
    t.setCopy(layer.id, 'Jetzt kaufen')
    const row = (await ask(t)).rows.find((r) => r.layerId === layer.id)
    expect(row).toEqual({
      directionId: t.directions[0],
      variantId: t.variants.de1,
      title: expect.any(String),
      sizeLabel: '1x1',
      language: 'de',
      layerId: layer.id,
      layerKey: layer.key,
      layerName: layer.name,
      sourceText: 'Shop now',
      text: 'Jetzt kaufen',
      status: layer.translationStatus,
      source: layer.translationSource,
      fontAssetId: 'fontAssetId' in layer.style ? layer.style.fontAssetId : null,
    })
  })

  it("gives a null source text for a layer the master lacks and '' for a null copy", async () => {
    const t = await setup()
    const layer = t.textLayers(t.variants.de1)[0]
    if (!layer) throw new Error('no text layer')
    t.db.prepare("UPDATE layer SET key = 'extra' WHERE id = ?").run(layer.id)
    t.setCopy(layer.id, null)
    const row = (await ask(t)).rows.find((r) => r.layerId === layer.id)
    expect(row).toMatchObject({ layerKey: 'extra', sourceText: null, text: '' })
  })

  it('answers the newest translation job per direction and language', async () => {
    const t = await setup()
    const [d1, d2] = t.directions
    const job = (id: string, directionId: string, status: string, createdAt: string) =>
      insertJob(t.db, {
        id,
        kind: 'translation',
        status,
        campaignId: t.campaignId,
        request: request(directionId, 'de'),
        createdAt,
      })
    job('J1', d1, 'failed', '2026-01-02T00:00:00.000Z')
    job('J2', d1, 'running', '2026-01-03T00:00:00.000Z')
    job('J0', d1, 'succeeded', '2026-01-01T00:00:00.000Z')
    job('J4', d2, 'queued', '2026-01-01T00:00:00.000Z')
    job('J5', d2, 'cancelled', '2026-01-01T00:00:00.000Z')
    job('J8', 'D-gone', 'failed', '2026-02-01T00:00:00.000Z')
    insertJob(t.db, { id: 'J6', campaignId: t.campaignId, createdAt: '2026-02-01T00:00:00.000Z' })
    insertJob(t.db, {
      id: 'J7',
      kind: 'translation',
      request: request(d1, 'de'),
      createdAt: '2026-02-01T00:00:00.000Z',
    })
    expect((await ask(t)).jobs).toEqual([
      { directionId: d1, language: 'de', jobId: 'J2', status: 'running', errorKind: null },
      { directionId: d2, language: 'de', jobId: 'J5', status: 'cancelled', errorKind: null },
    ])
  })

  it('answers the agent the same rows', async () => {
    const t = await setup()
    expect(await ask(t, 'agent')).toEqual(await ask(t, 'user'))
  })

  it("answers only this campaign's rows and jobs", async () => {
    const t = await setup()
    const other = data<{ campaignId: string }>(
      await t.fx.user('campaign.create', {
        projectId: t.projectId,
        ...createInput(),
        subjectMap: [
          { subjectId: 'can', create: false },
          { subjectId: 'bottle', create: false },
        ],
      }),
    )
    insertJob(t.db, {
      id: 'J9',
      kind: 'translation',
      campaignId: t.campaignId,
      request: request(t.directions[0], 'de'),
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    const mine = new Set(Object.values(t.variants))
    expect((await ask(t)).rows.every((r) => mine.has(r.variantId))).toBe(true)
    expect(await ask(t, 'user', other.campaignId)).toEqual({
      primaryLanguage: 'en',
      rows: [],
      jobs: [],
    })
  })

  it('refuses a campaign of another open project', async () => {
    const t = await setup()
    const b = data<{ projectId: string }>(
      await t.fx.user('project.create', { name: 'B', location: t.fx.projectsDir }),
    )
    const bc = data<{ campaignId: string }>(
      await t.fx.user('campaign.create', { projectId: b.projectId, ...createInput() }),
    )
    const input = { projectId: t.projectId, campaignId: bc.campaignId }
    expect(
      await t.fx.core.query('translation.forCampaign', input, { actor: 'user' }),
    ).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  })
})
