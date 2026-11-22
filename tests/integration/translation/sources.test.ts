// R3-3: translation.sources answers the text layers of the campaign's posts in the primary
// language (the Translations tab's editable source block) and the IDs of the translated text
// layers whose master copy changed since they last synced (spec/links-and-sync.md, "Out of date").
import { describe, it, expect, afterEach } from 'vitest'
import { data } from '../core-fixture'
import { makeRowsSetup, type RowsSetup } from './rows-fixture'
import type { TranslationSources } from '@/shared/schemas/queries/translation'

let s: RowsSetup | undefined
afterEach(() => {
  s?.fx.cleanup()
  s = undefined
})

async function setup() {
  s = await makeRowsSetup()
  return s
}

async function ask(t: RowsSetup, actor: 'user' | 'agent' = 'user') {
  const input = { projectId: t.projectId, campaignId: t.campaignId }
  return data<TranslationSources>(await t.fx.core.query('translation.sources', input, { actor }))
}

describe('translation.sources [R3-3]', () => {
  it('lists every text layer of the primary-language posts with its copy', async () => {
    const t = await setup()
    const [m1, m2] = t.masters
    const { en9 } = t.variants
    const master = t.textLayers(m1)[0]
    if (!master) throw new Error('no text layer')
    t.setCopy(master.id, 'Cool down')
    const reply = await ask(t)
    const ids = reply.rows.map((r) => r.variantId)
    expect(new Set(ids)).toEqual(new Set([m1, en9, m2]))
    expect(reply.rows.every((r) => r.language === 'en')).toBe(true)
    const row = reply.rows.find((r) => r.layerId === master.id)
    expect(row).toEqual({
      directionId: t.directions[0],
      variantId: m1,
      title: expect.any(String),
      sizeLabel: expect.any(String),
      language: 'en',
      layerId: master.id,
      layerName: master.name,
      text: 'Cool down',
      copyRev: master.revs.copy,
    })
    expect(reply.outOfDate).toEqual([])
  })

  it('marks the translations of a master text changed by layer.update as out of date', async () => {
    const t = await setup()
    const master = t.textLayers(t.masters[0])[0]
    if (!master) throw new Error('no text layer')
    await t.fx.user('layer.update', {
      projectId: t.projectId,
      layerId: master.id,
      patch: { copy: 'A new line' },
    })
    const reply = await ask(t)
    const stale = [t.variants.de1, t.variants.de9].flatMap((v) =>
      t
        .textLayers(v)
        .filter((l) => l.key === master.key)
        .map((l) => l.id),
    )
    expect(stale).toHaveLength(2)
    expect([...reply.outOfDate].sort()).toEqual([...stale].sort())
    expect(reply.rows.find((r) => r.layerId === master.id)?.text).toBe('A new line')
  })

  it('answers an agent as it answers the user', async () => {
    const t = await setup()
    expect(await ask(t, 'agent')).toEqual(await ask(t, 'user'))
  })
})
