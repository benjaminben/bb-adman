// P6-3 (spec/phases/phase-06.md, design addition 1, A-165): check.results reads the stored
// check of each variant that has one, says whether it is stale, and holds the engine's
// findings only: a missing file is named by its title, never by its path.
import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, data, type Fixture } from '../core-fixture'
import { openCheckProject, type CheckProject } from './check-fixture'
import type { CheckResultsReply } from '@/shared/schemas/queries/check'
import type { CheckRunReply } from '@/shared/schemas/commands/check'

let f: Fixture | undefined
afterEach(() => {
  f?.cleanup()
  f = undefined
})

async function setup(): Promise<{ fx: Fixture; p: CheckProject }> {
  const fx = makeFixture()
  f = fx
  return { fx, p: await openCheckProject(fx) }
}

const results = async (fx: Fixture, actor: 'user' | 'agent', input: object) =>
  data<CheckResultsReply>(await fx.core.query('check.results', input, { actor }))

const SECRET_PATH = '/Users/someone/private/brand-logo.png'

function insertLogo(p: CheckProject): void {
  p.db()
    .prepare(
      `INSERT INTO asset (id, library, kind, origin, storage, display_name, abs_path, rel_path,
        mime, byte_size, mtime_ms, content_hash, created_at)
       VALUES ('LOGO', 'asset', 'image', 'imported', 'linked', 'Brand logo', ?, 'brand-logo.png',
        'image/png', 1, 1, 'h', '2026-01-01T00:00:00.000Z')`,
    )
    .run(SECRET_PATH)
}

describe('check.results [P6-3, A-165]', () => {
  it('answers only variants with a check row, fresh after a run', async () => {
    const { fx, p } = await setup()
    const [id = '', other = ''] = p.variantIds()
    const ran = data<CheckRunReply>(
      await fx.user('check.run', { projectId: p.projectId, variantIds: [id] }),
    )
    for (const actor of ['user', 'agent'] as const) {
      const reply = await results(fx, actor, { projectId: p.projectId, campaignId: p.campaignId })
      expect(reply.variants).toEqual([
        {
          variantId: id,
          rev: p.variant(id).rev,
          checkedRev: p.variant(id).rev,
          stale: false,
          ranAt: p.checkRow(id)?.ranAt,
          ranBy: 'user',
          results: ran.variants[0]?.results,
        },
      ])
    }
    const byIds = await results(fx, 'user', { projectId: p.projectId, variantIds: [other] })
    expect(byIds.variants).toEqual([])
  })

  it('is stale after a layer.update', async () => {
    const { fx, p } = await setup()
    const [id = ''] = p.variantIds()
    data(await fx.user('check.run', { projectId: p.projectId, variantIds: [id] }))
    const text = (await p.layers(id)).find((l) => l.type === 'text')
    data(
      await fx.user('layer.update', {
        projectId: p.projectId,
        layerId: text?.id,
        patch: { copy: 'Changed' },
      }),
    )
    const [state] = (await results(fx, 'user', { projectId: p.projectId, variantIds: [id] }))
      .variants
    expect(state).toMatchObject({ stale: true, rev: p.variant(id).rev })
    expect(state?.checkedRev).toBeLessThan(state?.rev ?? 0)
  })

  it('names a missing required file by its title, and no reply holds its path', async () => {
    const { fx, p } = await setup()
    insertLogo(p)
    data(
      await fx.user('ruleSet.update', {
        projectId: p.projectId,
        campaignId: p.campaignId,
        requiredAssetIds: ['LOGO'],
      }),
    )
    const ran = await fx.agent('check.run', { projectId: p.projectId, campaignId: p.campaignId })
    const read = await results(fx, 'agent', { projectId: p.projectId, campaignId: p.campaignId })
    const required = read.variants[0]?.results.find((r) => r.checkId === 'required-assets')
    expect(required).toEqual({
      checkId: 'required-assets',
      group: 'brand-legal',
      status: 'warn',
      findings: [{ message: 'Brand logo is not shown on this post.' }],
    })
    for (const reply of [ran, read]) {
      expect(JSON.stringify(reply)).not.toContain('/Users/')
      expect(JSON.stringify(reply)).not.toContain('brand-logo.png')
    }
  })

  it('answers NOT_FOUND for a variant or campaign of another open project', async () => {
    const { fx, p } = await setup()
    const other = await openCheckProject(fx, 'B')
    data(await fx.user('check.run', { projectId: other.projectId, campaignId: other.campaignId }))
    for (const over of [{ variantIds: other.variantIds() }, { campaignId: other.campaignId }]) {
      const input = { projectId: p.projectId, ...over }
      expect(await fx.core.query('check.results', input, { actor: 'agent' })).toMatchObject({
        ok: false,
        error: { code: 'NOT_FOUND' },
      })
    }
  })
})
