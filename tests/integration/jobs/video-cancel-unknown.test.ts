// LP-2 (spec/cancel.md, "job.cancel"): the runner's timer is the one owner of the wait after a
// cancel that was not confirmed. The kind's own wait is made short here, so a kind that still
// timed the wait itself would end the job first, without outcomeUnknown.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { makeRunnerFixture, waitFor, type RunnerFixture } from './runner-fixture'
import { videoGenerationKind } from '@/main/jobs/kinds/video-generation'
import { fakeVideo } from '@/main/providers/fake/video'
import { resetFakeBehaviour, setFakeBehaviour } from '@/main/providers/fake/behaviour'
import type { VideoProvider } from '@/main/providers/types'
import type { VideoJobRequest } from '@/shared/schemas/jobs/video-generation'

vi.mock('@/main/jobs/cancel-wait', async (original) => ({
  ...(await original<typeof import('@/main/jobs/cancel-wait')>()),
  cancelWaitFor: () => 20,
}))

const RUNNER_WAIT_MS = 300
const POLL_MS = 10

const request: VideoJobRequest = {
  prompt: 'Waves',
  durationMs: 2_000,
  width: 1080,
  height: 1920,
  start: 'none',
  referenceAssetIds: [],
}

let x: RunnerFixture
afterEach(() => {
  resetFakeBehaviour()
  x.cleanup()
})

describe('a video job whose cancel is not confirmed [LP-2]', () => {
  it('ends cancelled with outcomeUnknown and no asset, and stops checking', async () => {
    x = makeRunnerFixture({ cancelWaitMs: RUNNER_WAIT_MS })
    setFakeBehaviour({ waitMs: 60_000, onCancel: 'no_confirm' })
    let checks = 0
    const real = fakeVideo()
    const counted: VideoProvider = { ...real, check: (id) => (checks++, real.check(id)) }
    const kind = videoGenerationKind({ videoFor: () => counted, pollMs: POLL_MS })
    x.f.body = (jc, job) => kind.run(jc, { ...job, request })
    const id = await x.start({ provider: 'fake', kind: 'video_generation' })
    await waitFor(() => checks > 0)
    await x.jobs.cancel(x.projectId, id)
    await waitFor(() => x.row(id)?.status === 'cancelled')
    const row = x.row(id)
    expect(row?.result).toMatchObject({ cancelAsked: true, outcomeUnknown: true })
    expect(row?.result).not.toHaveProperty('assetId')
    const seen = checks
    await new Promise((resolve) => setTimeout(resolve, POLL_MS * 10))
    expect(checks).toBe(seen)
  })
})
