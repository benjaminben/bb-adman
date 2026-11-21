// P6-6 (spec/phases/phase-06.md, design addition 2, "translation.propose"; A-154, A-156, A-157,
// A-169): one translation job per direction and language, its request built from the
// direction's master and the open project's own rows; every refusal comes before any job row.
import { describe, it, expect, afterEach } from 'vitest'
import { denialMessage } from '@/main/commands/agent-policy'
import { setFakeBehaviour } from '@/main/providers/fake/behaviour'
import type { TranslationJobRequest } from '@/shared/schemas/jobs/translation'
import { data } from '../core-fixture'
import { makeProposeFixture, waitFor, type ProposeFixture } from './propose-fixture'

let f: ProposeFixture
afterEach(() => f.cleanup())

async function ready() {
  f = await makeProposeFixture()
  // The jobs wait, so a test reads the queued rows as propose wrote them.
  setFakeBehaviour({ waitMs: 200 })
}

const propose = (input: Record<string, unknown>) => f.user('translation.propose', input)
const requestOf = (jobId: string) => f.job(jobId)?.request as TranslationJobRequest
const targetIds = (jobId: string) => requestOf(jobId).targets.map((t) => t.layerId)
const layerIdsOf = (variantId: string) => f.textKeys.map((key) => f.id(variantId, key))

async function settle() {
  for (const job of f.jobs()) await waitFor(() => f.ended(job.id))
}

describe('translation.propose [P6-6]', () => {
  it('by IDs across two directions starts two jobs, one per direction and language', async () => {
    await ready()
    const r = await propose({ provider: 'fake', variantIds: ['D1', 'X1'] })
    const { jobIds } = data<{ jobIds: string[] }>(r)
    expect(jobIds).toHaveLength(2)
    const [first, second] = jobIds.map((id) => f.job(id))
    for (const job of [first, second]) {
      expect(job).toMatchObject({
        kind: 'translation',
        campaignId: f.campaignId,
        variantId: null,
        layerId: null,
        slot: null,
        provider: 'fake',
        startedBy: 'user',
      })
    }
    const byDirection = new Map(jobIds.map((id) => [requestOf(id).directionId, id]))
    expect([...byDirection.keys()].sort()).toEqual([f.directionId, 'dir-2'].sort())
    expect(targetIds(byDirection.get(f.directionId) ?? '')).toEqual(layerIdsOf('D1'))
    expect(targetIds(byDirection.get('dir-2') ?? '')).toEqual(layerIdsOf('X1'))
    await settle()
  })

  it("by direction and language takes every variant of it; the request is the master's", async () => {
    await ready()
    const r = await propose({ provider: 'fake', directionId: f.directionId, language: 'de' })
    const [jobId = ''] = data<{ jobIds: string[] }>(r).jobIds
    const request = requestOf(jobId)
    const master = f.textKeys.map((key) => f.layer(f.masterLayerId(key)))
    expect(request).toEqual({
      mode: 'write',
      directionId: f.directionId,
      from: 'en',
      to: 'de',
      region: 'US',
      audience: 'Families',
      items: master.map((l) => ({ key: l.key, text: l.copy, masterCopyRev: l.revs.copy })),
      targets: [...layerIdsOf('D1'), ...layerIdsOf('D2')].map((id) => ({
        layerId: id,
        key: f.layer(id).key,
        copyRev: f.layer(id).revs.copy,
      })),
    })
    expect(f.jobs()).toHaveLength(1)
    await settle()
  })

  it.each([
    ['a post in the main language', () => ({ variantIds: ['D1', f.masterId] })],
    ['the main language by direction', () => ({ directionId: f.directionId, language: 'en' })],
  ])('refuses %s, with no job row', async (_name, input) => {
    await ready()
    expect(await propose({ provider: 'fake', ...input() })).toEqual({
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'These posts are in the main language.' },
    })
    expect(f.jobs()).toEqual([])
  })

  it.each([
    ['a post not in this project', { variantIds: ['D1', 'nope'] }, 'That post was not found.'],
    [
      'a direction not in this project',
      { directionId: 'nope', language: 'de' },
      'That direction was not found.',
    ],
  ])('refuses %s as NOT_FOUND, with no job row', async (_name, input, message) => {
    await ready()
    expect(await propose({ provider: 'fake', ...input })).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND', message },
    })
    expect(f.jobs()).toEqual([])
  })

  it('refuses a provider that cannot translate before it reads the posts', async () => {
    await ready()
    expect(await propose({ provider: 'nope', variantIds: ['nope'] })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'That provider cannot translate.' },
    })
    expect(f.jobs()).toEqual([])
  })

  it('gives NEEDS_KEY with no job row when the provider has no key', async () => {
    await ready()
    f.addKeyedProvider()
    expect(await propose({ provider: 'keyed', variantIds: ['D1'] })).toEqual({
      ok: false,
      error: {
        code: 'NEEDS_KEY',
        message: 'Add your Keyed key to translate.',
        details: { provider: 'keyed' },
      },
    })
    expect(f.jobs()).toEqual([])
  })

  it('refuses nothing_to_translate when the master has no text', async () => {
    await ready()
    for (const key of f.textKeys) f.setRow(f.masterLayerId(key), { copy: '   ' })
    expect(await propose({ provider: 'fake', variantIds: ['D1'] })).toEqual({
      ok: false,
      error: {
        code: 'RULE_VIOLATION',
        message: 'There is no text to translate.',
        details: { reason: 'nothing_to_translate' },
      },
    })
    expect(f.jobs()).toEqual([])
  })

  it('leaves out approved and copy-overridden layers; a group left empty is skipped [A-156]', async () => {
    await ready()
    expect(f.textKeys.length).toBeGreaterThanOrEqual(2)
    const [approved = '', ...restOfD1] = layerIdsOf('D1')
    const [overridden = '', ...restOfD2] = layerIdsOf('D2')
    f.setRow(approved, { translation_status: 'approved', translation_source: 'user' })
    f.setRow(overridden, { overrides: '["copy"]' })
    for (const id of layerIdsOf('F1')) f.setRow(id, { translation_status: 'approved' })
    const r = await propose({ provider: 'fake', variantIds: ['D1', 'D2', 'F1'] })
    const { jobIds } = data<{ jobIds: string[] }>(r)
    expect(jobIds).toHaveLength(1)
    expect(targetIds(jobIds[0] ?? '')).toEqual([...restOfD1, ...restOfD2])
    await settle()
  })

  it('refuses nothing_to_translate when every target is approved', async () => {
    await ready()
    for (const id of layerIdsOf('D1')) f.setRow(id, { translation_status: 'approved' })
    expect(await propose({ provider: 'fake', variantIds: ['D1'] })).toMatchObject({
      ok: false,
      error: { code: 'RULE_VIOLATION', details: { reason: 'nothing_to_translate' } },
    })
    expect(f.jobs()).toEqual([])
  })

  it('is denied to the agent, with no job row [A-169]', async () => {
    await ready()
    expect(await f.agent('translation.propose', { provider: 'fake', variantIds: ['D1'] })).toEqual({
      ok: false,
      error: { code: 'AGENT_DENIED', message: denialMessage('translation.propose') },
    })
    expect(f.jobs()).toEqual([])
  })
})
