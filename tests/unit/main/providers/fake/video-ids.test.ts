// P7-13: the fake video provider's remote IDs carry the run, so a new process answers for a
// run an earlier one started (the fake's runs survive a restart). The ID is read strictly; a
// malformed one is a failed run, and its text is never put in the failure.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { checkMp4 } from '@/main/providers/video-check'
import { FAKE_VIDEO_ID_PATTERN } from '@/main/providers/fake/video'

const input = {
  image: null,
  references: [],
  prompt: 'waves',
  durationMs: 4_000,
  width: 1080,
  height: 1920,
}

// The fake's video part from a fresh copy of its modules, as a new process has it.
async function freshVideo() {
  vi.resetModules()
  const video = await import('@/main/providers/fake/video')
  const behaviour = await import('@/main/providers/fake/behaviour')
  const { ProviderFailure } = await import('@/main/providers/types')
  return { video: video.fakeVideo(), setFakeBehaviour: behaviour.setFakeBehaviour, ProviderFailure }
}

afterEach(() => {
  vi.useRealTimers()
  vi.resetModules()
})

describe('fake video remote IDs [P7-13]', () => {
  it('names the start time, the wait, the size and the length', async () => {
    vi.useFakeTimers({ now: 1_700_000_000_000 })
    const { video, setFakeBehaviour } = await freshVideo()
    setFakeBehaviour({ waitMs: 3_000 })
    const { remoteJobId } = await video.start(input)
    expect(remoteJobId).toBe('fake-video-v1-1700000000000-3000-1080x1920-4000')
    expect(remoteJobId).toMatch(FAKE_VIDEO_ID_PATTERN)
  })

  it('a new process checks and fetches a run an earlier one started, by the clock', async () => {
    vi.useFakeTimers({ now: 1_700_000_000_000 })
    const first = await freshVideo()
    first.setFakeBehaviour({ waitMs: 3_000 })
    const { remoteJobId } = await first.video.start(input)
    const { video } = await freshVideo()
    expect((await video.check(remoteJobId)).status).toBe('running')
    vi.setSystemTime(1_700_000_003_000)
    expect((await video.check(remoteJobId)).status).toBe('succeeded')
    const result = await video.fetchResult(remoteJobId)
    expect(checkMp4(result.bytes)).toMatchObject({ hasSound: false })
  })

  it('a new process can still be asked to stop a run, and then reports it cancelled', async () => {
    const first = await freshVideo()
    first.setFakeBehaviour({ waitMs: 60_000 })
    const { remoteJobId } = await first.video.start(input)
    const { video } = await freshVideo()
    expect(await video.cancel(remoteJobId)).toBe('stopped')
    expect((await video.check(remoteJobId)).status).toBe('cancelled')
  })

  const MALFORMED = [
    'fake-video-1',
    'fake-v1-1700000000000-0-64x64-1000',
    'fake-video-v1-1700000000000-0-64x64-1000 ',
    ' fake-video-v1-1700000000000-0-64x64-1000',
    'fake-video-v1-1700000000000-0-64x64-1000\n',
    'fake-video-v1-01700000000000-0-64x64-1000',
    'fake-video-v1-1700000000000-00-64x64-1000',
    'fake-video-v1--1-0-64x64-1000',
    'fake-video-v1-1.5-0-64x64-1000',
    'fake-video-v1-1e12-0-64x64-1000',
    'fake-video-v1-99999999999999999-0-64x64-1000',
    'fake-video-v1-1700000000000-0-0x64-1000',
    'fake-video-v1-1700000000000-0-64x0-1000',
    'fake-video-v1-1700000000000-0-99999x64-1000',
    'fake-video-v1-1700000000000-0-64x64-0',
    'fake-video-v1-1700000000000-0-64x64-999999999',
    'fake-video-v1-1700000000000-0-64x64',
    'fake-video-v1-1700000000000-0-64x64-1000-1',
    'fake-video-v1-1700000000000-0-64x64-1000/../x',
    'fake-video-v2-1700000000000-0-64x64-1000',
    '',
  ]

  it.each(MALFORMED)('%j is a failed run on check, fetch and cancel', async (id) => {
    const { video, ProviderFailure } = await freshVideo()
    for (const call of [video.check, video.fetchResult, video.cancel]) {
      const error = await call(id).then(
        () => null,
        (e: unknown) => e,
      )
      expect(error).toBeInstanceOf(ProviderFailure)
      const failure = (error as InstanceType<typeof ProviderFailure>).error
      expect(failure.kind).toBe('other')
      if (id) expect(JSON.stringify(failure)).not.toContain(id.trim())
    }
  })
})
