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
import { resetFakeBehaviour, setFakeBehaviour } from '@/main/providers/fake/behaviour'
import { KEEP_PRINTING_ENDING, NO_TEXT_ENDING, promptToSend } from '@/shared/generation/prompt'
import { makeComfyFixture, type ComfyFixture } from './comfy-fixture'
import { startComfyStandIn, type StandIn } from '../../helpers/comfy-stand-in'
import { finishRun, serveNeeds } from '../../helpers/comfy-run'
import { greyPng } from '@/main/providers/fake/png'
import type { VideoJobResult } from '@/shared/schemas/jobs/video-generation'

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
        prompt: promptToSend('Waves on a rock', { pictures: 0 }),
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
  ])('refuses %s, no picture chosen: INVALID_INPUT, no job [1.60 N-4]', async (_, input) => {
    f = await makeGenerationFixture()
    expect(await start(input)).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'Choose one picture for this video.' },
    })
    expect(f.jobs()).toEqual([])
  })

  it.each([
    ['a first frame', { start: 'first_frame', referenceAssetIds: ['a1'] }],
    ['a reference', { useReferences: true, referenceAssetIds: ['a1'] }],
  ])(
    'the fake provider offers %s, so its picture is checked: NOT_FOUND [P7-11]',
    async (_, input) => {
      f = await makeGenerationFixture()
      expect(await start(input)).toMatchObject({
        ok: false,
        error: { code: 'NOT_FOUND' },
      })
      expect(f.jobs()).toEqual([])
    },
  )

  it('refuses a provider that does not make videos', async () => {
    f = await makeGenerationFixture()
    expect(await start({ provider: 'gemini' })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    })
    expect(f.jobs()).toEqual([])
  })

  it('refuses a provider that is not available, before a job row [SPEC 14 1.58 J-2]', async () => {
    f = await makeGenerationFixture()
    expect(await start({ provider: 'firefly' })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT', details: { provider: 'firefly' } },
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

describe('generation.startVideo stores the ending the pictures sent call for [SP-9; A-127]', () => {
  it('a prompt-only start stores "no text"', async () => {
    f = await makeGenerationFixture()
    const { jobId } = data<{ jobId: string }>(await start())
    expect(f.job(jobId)?.request).toMatchObject({ prompt: `Waves on a rock ${NO_TEXT_ENDING}` })
    await waitFor(ended(f, jobId), RUN_MS)
  }, 15_000)

  // Only ComfyUI takes a picture for a video, so these run against the stand-in. The outer
  // fixture is made too, since the file's afterEach cleans it up.
  let c: ComfyFixture | null = null
  let stand: StandIn | null = null
  afterEach(async () => {
    c?.cleanup()
    await stand?.close()
    c = null
    stand = null
  })

  // Fails the submitted run, so nothing is left going when the fixture is cleaned up.
  async function failRun(comfy: ComfyFixture, stub: StandIn, jobId: string) {
    await waitFor(() => stub.seen.some((r) => r.path === '/prompt'), RUN_MS)
    const sent = stub.seen.find((r) => r.path === '/prompt')?.body.toString('utf8') ?? '{}'
    const error = { status: { status_str: 'error', completed: false, messages: [] }, outputs: {} }
    finishRun(stub, (JSON.parse(sent) as { prompt_id: string }).prompt_id, error)
    await waitFor(() => comfy.job(jobId)?.status === 'failed', RUN_MS)
  }

  it.each([
    ['a first-frame start', { start: 'first_frame' }],
    ['a reference start', { useReferences: true }],
  ])(
    '%s stores "keep printing"',
    async (_, input) => {
      f = await makeGenerationFixture()
      const stub = await startComfyStandIn()
      stand = stub
      serveNeeds(stub)
      // A first frame is fitted to the run size before it is sent.
      const fitPicture = (_: Uint8Array, size: { width: number; height: number }) =>
        greyPng(size.width, size.height)
      const comfy = await makeComfyFixture({ devTools: true, origin: stub.origin, fitPicture })
      c = comfy
      const id = await comfy.importPicture('pics', 'can.png', greyPng(12, 16))
      const picked = { ...input, provider: 'comfyui', variantId: 'v1', referenceAssetIds: [id] }
      const r = await comfy.user('generation.startVideo', { ...ask, ...picked })
      const { jobId } = data<{ jobId: string }>(r)
      expect(comfy.job(jobId)?.request).toMatchObject({
        prompt: `Waves on a rock ${KEEP_PRINTING_ENDING}`,
      })
      await failRun(comfy, stub, jobId)
    },
    25_000,
  )
})
