// CU-6a: generation.startVideo through the real core with the fake video provider (SPEC 4.2,
// 6.10.7, 6.11.2, 14 1.41 CU-6a, 1.45 A-4).
import { describe, it, expect, afterEach } from 'vitest'
import {
  makeGenerationFixture,
  waitFor,
  ended,
  VARIANT,
  type GenerationFixture,
} from './generation-fixture'
import { data } from '../core-fixture'
import { resetFakeBehaviour, setFakeBehaviour } from '../../../src/main/providers/fake/behaviour'
import { promptToSend } from '../../../src/shared/generation/prompt'
import type { VideoJobResult } from '../../../src/shared/schemas/jobs/video-generation'

let f: GenerationFixture
afterEach(() => {
  f.cleanup()
  resetFakeBehaviour()
})

const RUN_MS = 10_000
const ask = {
  variantId: VARIANT,
  prompt: 'Waves on a rock',
  durationMs: 2_000,
  provider: 'fake',
  start: 'none',
  useReferences: false,
  referenceAssetIds: [],
}
const start = (input: Record<string, unknown> = {}) =>
  f.user('generation.startVideo', { ...ask, ...input })

describe('generation.startVideo [SPEC 4.2, 14 CU-6a]', () => {
  it('enqueues a video_generation job with the variant and campaign IDs, and stores the clip', async () => {
    f = await makeGenerationFixture()
    const { jobId } = data<{ jobId: string }>(await start())
    const queued = f.job(jobId)
    expect(queued).toMatchObject({
      kind: 'video_generation',
      campaignId: 'c1',
      variantId: VARIANT,
      layerId: null,
      slot: null,
      provider: 'fake',
      startedBy: 'user',
      request: {
        prompt: promptToSend('Waves on a rock'),
        durationMs: 2_000,
        width: 1080,
        height: 1350,
        start: 'none',
        referenceAssetIds: [],
      },
    })
    await waitFor(ended(f, jobId), RUN_MS)
    const job = f.job(jobId)
    expect(job?.status).toBe('succeeded')
    expect(job?.remoteJobId).toMatch(/^fake-video-/)
    const result = job?.result as VideoJobResult
    expect(result).toMatchObject({ hasSound: false, details: 'pending', durationMs: 1_000 })
    expect(f.asset(result.assetId)).toMatchObject({ kind: 'video', genRunId: jobId })
  }, 15_000)

  it.each([
    ['a first frame', { start: 'first_frame' }],
    ['references', { useReferences: true }],
    ['reference pictures without useReferences', { referenceAssetIds: ['a1'] }],
  ])('refuses %s with comfy_job_not_offered before a job row (CU-6b)', async (_, input) => {
    f = await makeGenerationFixture()
    expect(await start(input)).toMatchObject({
      ok: false,
      error: { code: 'RULE_VIOLATION', details: { reason: 'comfy_job_not_offered' } },
    })
    expect(f.jobs()).toEqual([])
  })

  it('refuses a provider that does not make videos', async () => {
    f = await makeGenerationFixture()
    expect(await start({ provider: 'gemini' })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    })
    expect(f.jobs()).toEqual([])
  })

  it('refuses a variant that is not there', async () => {
    f = await makeGenerationFixture()
    expect(await start({ variantId: 'nope' })).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    })
  })
})

describe('cancelling a video job [SPEC 6.11.2]', () => {
  async function cancelled(onCancel: 'stop' | 'finish') {
    f = await makeGenerationFixture()
    setFakeBehaviour({ waitMs: 60_000, onCancel })
    const { jobId } = data<{ jobId: string }>(await start())
    await waitFor(() => f.job(jobId)?.remoteJobId !== null, RUN_MS)
    data(await f.user('job.cancel', { jobId }))
    await waitFor(ended(f, jobId), RUN_MS)
    return f.job(jobId)
  }

  it('the provider stopped the run: cancelled, nothing stored', async () => {
    const job = await cancelled('stop')
    expect(job?.status).toBe('cancelled')
    const assets = f.db.prepare('SELECT COUNT(*) AS n FROM asset').get() as { n: number }
    expect(assets.n).toBe(0)
  }, 15_000)

  it('the provider finished anyway: succeeded with finishedAfterCancel, the clip stored', async () => {
    const job = await cancelled('finish')
    expect(job).toMatchObject({ status: 'succeeded', result: { finishedAfterCancel: true } })
    expect(f.asset((job?.result as VideoJobResult).assetId)?.kind).toBe('video')
  }, 15_000)
})
