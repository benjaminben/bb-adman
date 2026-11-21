// P6-3 (spec/phases/phase-06.md, design additions 1 and 5): check.run runs the engine on each
// named variant, stores one variant_check row per variant and answers the results. It changes
// no rev, records no undo entry, and both the user and the agent may run it.
import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, data, type Fixture } from '../core-fixture'
import { expectChanges } from '../expect-changes'
import { openCheckProject, type CheckProject } from './check-fixture'
import { AGENT_POLICY } from '@/main/commands/agent-policy'
import { CHECK_IDS } from '@/shared/schemas/checks'
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

const run = (fx: Fixture, actor: 'user' | 'agent', input: object) =>
  fx.core.bus.execute('check.run', input, { actor })

const scopesOf = (p: CheckProject) => [
  `campaign:${p.campaignId}`,
  ...p.variantIds().map((id) => `variant:${id}`),
]

describe('check.run [P6-3, design addition 5]', () => {
  it('by campaign: checks every variant of the campaign and stores what it answers', async () => {
    const { fx, p } = await setup()
    const reply = data<CheckRunReply>(
      await run(fx, 'user', { projectId: p.projectId, campaignId: p.campaignId }),
    )
    expect(reply.variants.map((v) => v.variantId).sort()).toEqual(p.variantIds())
    for (const v of reply.variants) {
      expect(v.results.map((r) => r.checkId)).toEqual([...CHECK_IDS])
      expect(v.checkedRev).toBe(p.variant(v.variantId).rev)
      expect(p.checkRow(v.variantId)).toMatchObject({
        checkedRev: p.variant(v.variantId).rev,
        ranBy: 'user',
        results: v.results,
      })
    }
  })

  it('by IDs: checks only the named variants', async () => {
    const { fx, p } = await setup()
    const [first, ...rest] = p.variantIds()
    const reply = data<CheckRunReply>(
      await run(fx, 'user', { projectId: p.projectId, variantIds: [first] }),
    )
    expect(reply.variants.map((v) => v.variantId)).toEqual([first])
    expect(rest.length).toBeGreaterThan(0)
    for (const id of rest) expect(p.checkRow(id)).toBeNull()
  })

  it('stores checked_rev as the variant rev, after the rev moved', async () => {
    const { fx, p } = await setup()
    const [id = ''] = p.variantIds()
    const text = (await p.layers(id)).find((l) => l.type === 'text')
    data(
      await fx.user('layer.update', {
        projectId: p.projectId,
        layerId: text?.id,
        patch: { copy: 'New' },
      }),
    )
    const rev = p.variant(id).rev
    expect(rev).toBeGreaterThan(0)
    const reply = data<CheckRunReply>(
      await run(fx, 'user', { projectId: p.projectId, variantIds: [id] }),
    )
    expect(reply.variants[0]?.checkedRev).toBe(rev)
    expect(p.checkRow(id)?.checkedRev).toBe(rev)
  })

  it('the agent may run it, and the row says ran_by agent', async () => {
    const { fx, p } = await setup()
    expect(AGENT_POLICY['check.run']?.policy).toBe('allow')
    const [id = ''] = p.variantIds()
    expect(await run(fx, 'agent', { projectId: p.projectId, variantIds: [id] })).toMatchObject({
      ok: true,
    })
    expect(p.checkRow(id)?.ranBy).toBe('agent')
  })

  it('replaces the earlier row of a variant', async () => {
    const { fx, p } = await setup()
    const [id = ''] = p.variantIds()
    await run(fx, 'agent', { projectId: p.projectId, variantIds: [id, id] })
    await run(fx, 'user', { projectId: p.projectId, variantIds: [id] })
    const count = p.db().prepare('SELECT COUNT(*) AS n FROM variant_check').get() as { n: number }
    expect(count.n).toBe(1)
    expect(p.checkRow(id)?.ranBy).toBe('user')
  })

  it('changes no rev and records no undo entry', async () => {
    const { fx, p } = await setup()
    const revs = () => p.variantIds().map((id) => p.variant(id).rev)
    const undo = () => scopesOf(p).map((s) => fx.core.undo.state(p.projectId, s))
    const [revsBefore, undoBefore] = [revs(), undo()]
    data(await run(fx, 'agent', { projectId: p.projectId, campaignId: p.campaignId }))
    expect(revs()).toEqual(revsBefore)
    expect(undo()).toEqual(undoBefore)
    expect(p.variant(p.variantIds()[0] ?? '').agentChangedAt).toBeNull()
  })

  it('emits project.changed with exactly the variant_check rows', async () => {
    const { fx, p } = await setup()
    const target = { db: p.db(), events: fx.events, projectId: p.projectId }
    await expectChanges(target, () =>
      run(fx, 'user', { projectId: p.projectId, campaignId: p.campaignId }),
    )
    const event = fx.events.at(-1)
    expect(event?.name).toBe('project.changed')
    if (event?.name !== 'project.changed') return
    expect(Object.keys(event.payload.changed)).toEqual(['variant_check'])
    expect(event.payload.changed.variant_check).toHaveLength(p.variantIds().length)
  })
})

describe('check.run refusals [P6-3, security]', () => {
  it('answers NOT_FOUND for a variant ID from another open project, and writes nothing', async () => {
    const { fx, p } = await setup()
    const other = await openCheckProject(fx, 'B')
    expect(fx.core.projects.requireOpen(p.projectId)).toBeDefined()
    const [mine = ''] = p.variantIds()
    const [theirs = ''] = other.variantIds()
    for (const actor of ['user', 'agent'] as const) {
      const input = { projectId: p.projectId, variantIds: [mine, theirs] }
      expect(await run(fx, actor, input)).toMatchObject({
        ok: false,
        error: { code: 'NOT_FOUND' },
      })
    }
    expect(p.checkRow(mine)).toBeNull()
    expect(other.checkRow(theirs)).toBeNull()
  })

  it('answers NOT_FOUND for a campaign from another open project', async () => {
    const { fx, p } = await setup()
    const other = await openCheckProject(fx, 'B')
    const input = { projectId: p.projectId, campaignId: other.campaignId }
    expect(await run(fx, 'agent', input)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  })

  it.each([
    ['both targets', { campaignId: 'C', variantIds: ['V'] }],
    ['no target', {}],
    ['an empty list', { variantIds: [] }],
    ['more than 1000 IDs', { variantIds: Array.from({ length: 1001 }, (_, i) => `V${i}`) }],
    ['results given by the caller', { campaignId: 'C', results: [] }],
  ])('refuses %s as INVALID_INPUT', async (_, over) => {
    const { fx, p } = await setup()
    expect(await run(fx, 'agent', { projectId: p.projectId, ...over })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    })
  })
})
