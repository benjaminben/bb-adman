// The fake provider's video (SPEC 14 slice D, 6.11.1). Runs are kept in memory by ID; a run
// succeeds once its wait is over, or fails with the kind it was told to.
import { FAKE_FAILURE_DETAIL, fakeBehaviour, type FakeBehaviour } from './behaviour'
import type { CancelOutcome, VideoProvider } from '../types'
import { mp4File } from './mp4'

export const FAKE_VIDEO_MODEL = 'fake-video'

type Run = { readyAt: number; behaviour: FakeBehaviour; cancelled: boolean }

const runs = new Map<string, Run>()
let nextId = 1

// [CU-6a] A small MP4 that checkMp4 accepts: one 64 by 64 video track, one second, no sound.
const tinyMp4 = () => mp4File({ width: 64, height: 64, durationMs: 1_000, sound: false })

function find(remoteJobId: string): Run {
  const run = runs.get(remoteJobId)
  if (!run) throw new Error('Unknown fake video run')
  return run
}

const OUTCOMES: Record<FakeBehaviour['onCancel'], CancelOutcome> = {
  stop: 'stopped',
  finish: 'finished',
  no_confirm: 'unknown',
}

export function fakeVideo(): VideoProvider {
  return {
    async start() {
      const behaviour = { ...fakeBehaviour() }
      const remoteJobId = `fake-video-${nextId++}`
      runs.set(remoteJobId, { readyAt: Date.now() + behaviour.waitMs, behaviour, cancelled: false })
      return { remoteJobId }
    },
    async check(remoteJobId) {
      const run = find(remoteJobId)
      const { fail } = run.behaviour
      if (run.cancelled) return { status: 'cancelled' }
      if (fail) return { status: 'failed', error: { kind: fail, detail: FAKE_FAILURE_DETAIL } }
      return Date.now() >= run.readyAt ? { status: 'succeeded' } : { status: 'running' }
    },
    async fetchResult(remoteJobId) {
      find(remoteJobId)
      return { bytes: tinyMp4(), mime: 'video/mp4', model: FAKE_VIDEO_MODEL }
    },
    async cancel(remoteJobId) {
      const run = find(remoteJobId)
      const outcome = OUTCOMES[run.behaviour.onCancel]
      if (outcome === 'stopped') run.cancelled = true
      if (outcome === 'finished') run.readyAt = 0
      return outcome
    },
  }
}
