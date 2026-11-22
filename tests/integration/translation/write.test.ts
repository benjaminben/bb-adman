// P6-6 (spec/phases/phase-06.md, design addition 2, "translation.write"; A-155): the system
// command only the translation job sends. Internal (no window may send it), denied to the agent,
// and it writes only layers of its own running job's campaign, direction and language, found
// in the project's file; the input names keys and texts, never layers.
import { describe, it, expect, afterEach } from 'vitest'
import { denialMessage } from '@/main/commands/agent-policy'
import { registerIpc, IPC } from '@/main/ipc'
import { setFakeBehaviour } from '@/main/providers/fake/behaviour'
import { MAX_TRANSLATION_ITEMS } from '@/shared/schemas/commands/translation'
import type { TranslationJobRequest } from '@/shared/schemas/jobs/translation'
import { ok } from '@/shared/schemas/result'
import { data } from '../core-fixture'
import { makeProposeFixture, waitFor, type ProposeFixture } from './propose-fixture'

let f: ProposeFixture
afterEach(() => f.cleanup())

const write = (jobId: string, items: Array<{ key: string; text: string }>) =>
  f.user('translation.write', { jobId, items })

// A translation job for D1 held running by the fake.
async function runningJob(): Promise<string> {
  f = await makeProposeFixture()
  setFakeBehaviour({ waitMs: 2_000 })
  const r = await f.user('translation.propose', { provider: 'fake', variantIds: ['D1'] })
  const [jobId = ''] = data<{ jobIds: string[] }>(r).jobIds
  await waitFor(() => f.job(jobId)?.status === 'running')
  return jobId
}

async function stop(jobId: string) {
  await f.user('job.cancel', { jobId })
  await waitFor(() => f.ended(jobId))
}

describe('translation.write [P6-6]', () => {
  it('is internal: a window that sends it is answered unknown and nothing runs', async () => {
    const jobId = await runningJob()
    type Handler = (event: unknown, ...args: unknown[]) => unknown
    const handlers = new Map<string, Handler>()
    const sent: string[] = []
    registerIpc(
      { handle: (channel: string, fn: Handler) => void handlers.set(channel, fn) },
      {
        execute: (name, input, opts) => {
          sent.push(name)
          return f.core.bus.execute(name, input, opts)
        },
        query: async () => ok(null),
        isInternal: (name) => f.core.isInternal(name),
        mayCall: () => true,
      },
    )
    const input = { projectId: f.projectId, jobId, items: [{ key: f.textKeys[0], text: 'x' }] }
    expect(await handlers.get(IPC.command)?.({}, 'translation.write', input)).toEqual({
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'Unknown command: translation.write' },
    })
    expect(sent).toEqual([])
    expect(f.core.isInternal('translation.write')).toBe(true)
    await stop(jobId)
  })

  it('is denied to the agent', async () => {
    const jobId = await runningJob()
    const input = { jobId, items: [{ key: f.textKeys[0] ?? '', text: 'x' }] }
    expect(await f.agent('translation.write', input)).toEqual({
      ok: false,
      error: { code: 'AGENT_DENIED', message: denialMessage('translation.write') },
    })
    expect(f.layer(f.id('D1', f.textKeys[0] ?? '')).translationStatus).toBe('missing')
    await stop(jobId)
  })

  it('writes only its own targets of its campaign, direction and language', async () => {
    const jobId = await runningJob()
    const [key = ''] = f.textKeys
    const job = f.job(jobId)
    const request = job?.request as TranslationJobRequest
    // Rows the request should never hold: another language, another direction, the master,
    // and a layer whose key differs from the target's.
    const planted = [f.id('F1', key), f.id('X1', key), f.masterLayerId(key)].map((layerId) => ({
      layerId,
      key,
      copyRev: f.layer(layerId).revs.copy,
    }))
    const wrongKey = { layerId: f.id('D2', f.textKeys[1] ?? ''), key, copyRev: 0 }
    const tampered = { ...request, targets: [...request.targets, ...planted, wrongKey] }
    f.db.prepare('UPDATE job SET request = ? WHERE id = ?').run(JSON.stringify(tampered), jobId)
    const before = [...planted.map((t) => t.layerId), wrongKey.layerId].map((id) => f.layer(id))
    const r = await write(jobId, [
      { key, text: 'Hallo' },
      { key: 'not-asked', text: 'x' },
    ])
    expect(r).toEqual({ ok: true, data: { written: 1 } })
    expect(f.layer(f.id('D1', key))).toMatchObject({
      copy: 'Hallo',
      translationStatus: 'proposed',
      translationSource: 'ai',
    })
    expect(before.map((l) => f.layer(l.id))).toEqual(before)
    await stop(jobId)
  })

  it('refuses a job that is not a running translation job', async () => {
    const jobId = await runningJob()
    await stop(jobId)
    const refused = {
      ok: false,
      error: { code: 'NOT_FOUND', message: 'That translation run was not found.' },
    }
    expect(await write(jobId, [{ key: f.textKeys[0] ?? '', text: 'x' }])).toEqual(refused)
    expect(await write('nope', [{ key: f.textKeys[0] ?? '', text: 'x' }])).toEqual(refused)
    expect(f.layer(f.id('D1', f.textKeys[0] ?? '')).translationStatus).toBe('missing')
  })

  it.each([
    ['a text over 5000 code points', [{ key: 'k', text: '😀'.repeat(5001) }]],
    ['an empty text', [{ key: 'k', text: '' }]],
    [
      'more items than a job sends',
      Array.from({ length: MAX_TRANSLATION_ITEMS + 1 }, (_, i) => ({ key: `k${i}`, text: 'x' })),
    ],
    ['an item with a layer ID', [{ key: 'k', text: 'x', layerId: 'D1-headline' }]],
  ])('refuses %s as INVALID_INPUT', async (_name, items) => {
    f = await makeProposeFixture()
    expect(await f.user('translation.write', { jobId: 'J1', items })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    })
  })

  it('takes a text of 5000 code points that is 10000 UTF-16 units', async () => {
    const jobId = await runningJob()
    const [key = ''] = f.textKeys
    const text = '😀'.repeat(5000)
    expect(await write(jobId, [{ key, text }])).toEqual({ ok: true, data: { written: 1 } })
    expect(f.layer(f.id('D1', key)).copy).toBe(text)
    await stop(jobId)
  })

  // P6-16, Phase 5 review: a layer of the direction's master, or of a post in the campaign's
  // main language, is never a translation the AI may replace.
  it.each([
    [
      "the direction's master",
      () =>
        f.db
          .prepare("UPDATE direction SET master_variant_id = 'D1' WHERE id = ?")
          .run(f.directionId),
    ],
    [
      "a post in the campaign's main language",
      () =>
        f.db.prepare("UPDATE campaign SET primary_language = 'de' WHERE id = ?").run(f.campaignId),
    ],
  ])('leaves a layer of %s alone', async (_name, plant) => {
    const jobId = await runningJob()
    const [key = ''] = f.textKeys
    plant()
    const before = f.layer(f.id('D1', key))
    expect(await write(jobId, [{ key, text: 'Hallo' }])).toEqual({ ok: true, data: { written: 0 } })
    expect(f.layer(f.id('D1', key))).toEqual(before)
    await stop(jobId)
  })
})
