// P7-16 (A-176): a `background` video start draws its first frame from the variant's
// background at job time, through RenderService.renderBackground at the run size, then
// fitPicture. A failed draw ends the job with background_not_drawn before any provider call.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { makeGenerationFixture, waitFor, ended, type GenerationFixture } from './generation-fixture'
import { adapters as fakeAdapters } from '@/main/providers/fake'
import { fakeVideo } from '@/main/providers/fake/video'
import type { VideoProvider } from '@/main/providers/types'
import type { ProjectContext } from '@/main/commands/types'
import type { VideoJobRequest } from '@/shared/schemas/jobs/video-generation'

let f: GenerationFixture
afterEach(() => {
  f.cleanup()
  vi.restoreAllMocks()
})

const RUN_MS = 10_000
const DRAWN = new Uint8Array([9, 9, 9])
const FITTED = new Uint8Array([7, 7])
const request: VideoJobRequest = {
  prompt: 'The shop front at dawn',
  durationMs: 2_000,
  width: 1080,
  height: 1350,
  start: 'background',
  referenceAssetIds: [],
}

// The fake's video part, with a run size and each start's input kept.
function watched(runSize?: VideoProvider['runSize']) {
  const starts: Array<Parameters<VideoProvider['start']>[0]> = []
  vi.spyOn(fakeAdapters, 'video').mockImplementation(() => {
    const real = fakeVideo()
    return {
      ...real,
      ...(runSize && { runSize }),
      start: (input, opts) => (starts.push(input), real.start(input, opts)),
    }
  })
  return starts
}

function enqueue(variantId = 'v1'): string {
  const ctx = { project: f.project } as unknown as ProjectContext
  return f.core.deps.jobs.enqueue(ctx, {
    kind: 'video_generation',
    campaignId: 'c1',
    variantId,
    layerId: null,
    slot: null,
    provider: 'fake',
    model: '',
    request,
    startedBy: 'user',
  })
}

describe('a background start draws its first frame [P7-16, A-176]', () => {
  it('asks renderBackground at the run size, fits the drawing and sends it as the frame', async () => {
    f = await makeGenerationFixture()
    const starts = watched(() => ({ width: 720, height: 896 }))
    const render = vi.fn(async () => DRAWN)
    f.core.deps.render.renderBackground = render
    const fit = vi.fn(() => FITTED)
    f.core.deps.fitPicture = fit
    const jobId = enqueue()
    await waitFor(ended(f, jobId), RUN_MS)
    expect(f.job(jobId)).toMatchObject({ status: 'succeeded', paidCalls: 0 })
    expect(render).toHaveBeenCalledWith(f.project, 'v1', { width: 720, height: 896 })
    expect(fit).toHaveBeenCalledWith(DRAWN, { width: 720, height: 896 })
    expect(starts).toHaveLength(1)
    expect(starts[0]).toMatchObject({ image: { bytes: FITTED, mime: 'image/png' }, references: [] })
  })

  it('a provider with no run size: the variant size', async () => {
    f = await makeGenerationFixture()
    watched()
    const render = vi.fn(async () => DRAWN)
    f.core.deps.render.renderBackground = render
    f.core.deps.fitPicture = () => FITTED
    const jobId = enqueue()
    await waitFor(ended(f, jobId), RUN_MS)
    expect(render).toHaveBeenCalledWith(f.project, 'v1', { width: 1080, height: 1350 })
  })

  it.each([
    ['the draw fails', () => Promise.reject(new Error('/private/draw failed'))],
    ['the fit fails', async () => DRAWN],
  ])('%s: the job fails with background_not_drawn and starts nothing', async (name, draw) => {
    f = await makeGenerationFixture()
    const starts = watched()
    f.core.deps.render.renderBackground = draw
    f.core.deps.fitPicture = () => {
      if (name === 'the fit fails') throw new Error('/private/fit failed')
      return FITTED
    }
    const jobId = enqueue()
    await waitFor(ended(f, jobId), RUN_MS)
    expect(f.job(jobId)).toMatchObject({
      status: 'failed',
      errorReason: 'background_not_drawn',
      paidCalls: 0,
    })
    expect(starts).toHaveLength(0)
    expect(JSON.stringify(f.job(jobId))).not.toContain('/private')
  })

  it('with the fixture render service (no draw window): background_not_drawn', async () => {
    f = await makeGenerationFixture()
    const starts = watched()
    const jobId = enqueue()
    await waitFor(ended(f, jobId), RUN_MS)
    expect(f.job(jobId)).toMatchObject({ status: 'failed', errorReason: 'background_not_drawn' })
    expect(starts).toHaveLength(0)
  })
})
