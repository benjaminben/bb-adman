// CU-6a: the video_generation job kind through the real core with the fake video provider
// (SPEC 6.10.7, 6.11.2, 14 1.40 "A left-over video run is only checked and fetched").
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  makeGenerationFixture,
  waitFor,
  ended,
  type GenerationFixture,
} from '../generation/generation-fixture'
import { adapters as fakeAdapters } from '@/main/providers/fake'
import { fakeVideo } from '@/main/providers/fake/video'
import { resetFakeBehaviour, setFakeBehaviour } from '@/main/providers/fake/behaviour'
import type { VideoProvider } from '@/main/providers/types'
import type { VideoJobRequest, VideoJobResult } from '@/shared/schemas/jobs/video-generation'
import { checkMp4 } from '@/main/providers/video-check'
import type { ProjectContext } from '@/main/commands/types'
import { KEEP_PRINTING_ENDING, NO_TEXT_ENDING } from '@/shared/generation/prompt'

let f: GenerationFixture
afterEach(() => {
  f.cleanup()
  vi.restoreAllMocks()
  resetFakeBehaviour()
})

const RUN_MS = 10_000
const request: VideoJobRequest = {
  prompt: 'Waves',
  durationMs: 2_000,
  width: 1080,
  height: 1920,
  start: 'none',
  referenceAssetIds: [],
}

// The fake's video part, with its start counted.
function countStarts(): { starts: () => number } {
  let starts = 0
  vi.spyOn(fakeAdapters, 'video').mockImplementation(() => {
    const real = fakeVideo()
    const counted: VideoProvider = {
      ...real,
      start: (input) => {
        starts += 1
        return real.start(input)
      },
    }
    return counted
  })
  return { starts: () => starts }
}

function leftOver(id: string, remoteJobId: string): void {
  f.db
    .prepare(
      `INSERT INTO job (id, kind, status, provider, model, request, remote_job_id, campaign_id,
         variant_id, created_at, updated_at)
       VALUES (?, 'video_generation', 'running', 'fake', '', ?, ?, 'c1', 'v1',
         '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
    )
    .run(id, JSON.stringify(request), remoteJobId)
}

describe('a left-over video run is only checked and fetched [SPEC 14 1.40] (security class)', () => {
  it('checks and fetches a row with a remote ID and never calls start', async () => {
    f = await makeGenerationFixture()
    const { remoteJobId } = await fakeVideo().start({ ...request, image: null, references: [] })
    const { starts } = countStarts()
    leftOver('j-left', remoteJobId)
    await f.core.deps.jobs.projectOpened(f.projectId)
    await waitFor(ended(f, 'j-left'), RUN_MS)
    const job = f.job('j-left')
    expect(job).toMatchObject({ status: 'succeeded', paidCalls: 0, remoteJobId })
    expect(starts()).toBe(0)
    const result = job?.result as VideoJobResult
    expect(result).toMatchObject({ hasSound: false, details: 'pending', width: 64, height: 64 })
    const stored = fs.readFileSync(path.join(f.assetsDir(), `${result.assetId}.mp4`))
    expect(checkMp4(stored).durationMs).toBe(1_000)
    expect(f.asset(result.assetId)).toMatchObject({ kind: 'video', mime: 'video/mp4' })
  }, 15_000)

  it('a remote ID the provider does not know ends the job failed and stores no asset', async () => {
    f = await makeGenerationFixture()
    const { starts } = countStarts()
    leftOver('j-unknown', 'fake-video-not-known')
    await f.core.deps.jobs.projectOpened(f.projectId)
    await waitFor(ended(f, 'j-unknown'), RUN_MS)
    expect(f.job('j-unknown')).toMatchObject({ status: 'failed', result: null })
    expect(starts()).toBe(0)
    const assets = f.db.prepare('SELECT COUNT(*) AS n FROM asset').get() as { n: number }
    expect(assets.n).toBe(0)
  }, 15_000)
})

describe('the video_generation job kind [SPEC 6.10.7, 6.11.2, 14 CU-6a]', () => {
  it('a provider failure ends the job failed with its kind, and nothing is stored', async () => {
    f = await makeGenerationFixture()
    setFakeBehaviour({ fail: 'quota' })
    const { remoteJobId } = await fakeVideo().start({ ...request, image: null, references: [] })
    leftOver('j-fail', remoteJobId)
    await f.core.deps.jobs.projectOpened(f.projectId)
    await waitFor(ended(f, 'j-fail'), RUN_MS)
    expect(f.job('j-fail')).toMatchObject({ status: 'failed', errorKind: 'quota' })
  }, 15_000)
})

describe('the video_generation job kind sends the ending its pictures call for [SP-9; A-127]', () => {
  // The prompt each call to the fake's start is given.
  function promptsSent(): string[] {
    const prompts: string[] = []
    vi.spyOn(fakeAdapters, 'video').mockImplementation(() => {
      const real = fakeVideo()
      return {
        ...real,
        start: (input) => {
          prompts.push(input.prompt)
          return real.start(input)
        },
      }
    })
    return prompts
  }

  // Straight onto the queue: generation.startVideo does not offer the fake a first frame.
  function enqueue(job: VideoJobRequest): string {
    const ctx = { project: f.project } as unknown as ProjectContext
    return f.core.deps.jobs.enqueue(ctx, {
      kind: 'video_generation',
      campaignId: 'c1',
      variantId: 'v1',
      layerId: null,
      slot: null,
      provider: 'fake',
      model: '',
      request: job,
      startedBy: 'user',
    })
  }

  it('gives start "keep printing" for a first-frame request', async () => {
    f = await makeGenerationFixture()
    // The fixture has no picture fitter; the fake takes the frame as it is.
    f.core.deps.fitPicture = (bytes) => bytes
    const prompts = promptsSent()
    const id = await f.importPicture()
    const jobId = enqueue({ ...request, start: 'first_frame', referenceAssetIds: [id] })
    await waitFor(ended(f, jobId), RUN_MS)
    expect(prompts).toEqual([`Waves ${KEEP_PRINTING_ENDING}`])
  }, 15_000)

  it('gives start "no text" for a prompt-only request', async () => {
    f = await makeGenerationFixture()
    const prompts = promptsSent()
    const jobId = enqueue(request)
    await waitFor(ended(f, jobId), RUN_MS)
    expect(prompts).toEqual([`Waves ${NO_TEXT_ENDING}`])
  }, 15_000)
})
