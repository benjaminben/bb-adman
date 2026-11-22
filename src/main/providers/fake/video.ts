// The fake provider's video (SPEC 14 slice D, 6.11.1; P7-13). The remote ID carries the run:
// fake-video-v1-{startedAtMs}-{waitMs}-{width}x{height}-{durationMs}. check and fetchResult
// work from the ID and the clock, so a new process answers for a run an earlier one started.
// What a test told this process (a failure, the cancel answer, a stop) is kept in memory; a
// run this process did not start succeeds once its wait is over. The ID is read strictly: a
// malformed one is a failed run, and the failure never holds the ID's text.
import { FAKE_FAILURE_DETAIL, fakeBehaviour, type FakeBehaviour } from './behaviour'
import { ProviderFailure, type CancelOutcome, type VideoProvider } from '@/main/providers/types'
import { mp4File } from './mp4'

export const FAKE_VIDEO_MODEL = 'fake-video'

// Whole numbers with no sign, no leading zero and a bounded length.
const N = (digits: number) => `(0|[1-9]\\d{0,${digits - 1}})`
const P = (digits: number) => `([1-9]\\d{0,${digits - 1}})`
export const FAKE_VIDEO_ID_PATTERN = new RegExp(
  `^fake-video-v1-${N(15)}-${N(9)}-${P(5)}x${P(5)}-${P(6)}$`,
)
const MAX_SIDE = 16_384
const MAX_DURATION_MS = 120_000

// cancelled: a stop was confirmed; finished: a cancel answered that it finishes now.
type Run = {
  behaviour: Pick<FakeBehaviour, 'fail' | 'onCancel'>
  cancelled: boolean
  finished: boolean
}

const runs = new Map<string, Run>()
const AFTER_RESTART: Run['behaviour'] = { fail: null, onCancel: 'stop' }

// [CU-6a] A small MP4 that checkMp4 accepts: one 64 by 64 video track, one second, no sound.
const tinyMp4 = () => mp4File({ width: 64, height: 64, durationMs: 1_000, sound: false })

const malformed = () =>
  new ProviderFailure({ kind: 'other', detail: 'The fake video run ID is not valid' })

// When the run is ready, read from its ID.
function readyAt(remoteJobId: string): number {
  const match = FAKE_VIDEO_ID_PATTERN.exec(remoteJobId)
  if (!match) throw malformed()
  const [startedAt = 0, waitMs = 0, width = 0, height = 0, durationMs = 0] = match
    .slice(1)
    .map(Number)
  const inRange = width <= MAX_SIDE && height <= MAX_SIDE && durationMs <= MAX_DURATION_MS
  if (!inRange) throw malformed()
  return startedAt + waitMs
}

// What this process knows of the run, made on first sight of an ID after a restart. Throws
// for a malformed ID.
function find(remoteJobId: string): Run {
  readyAt(remoteJobId)
  const run = runs.get(remoteJobId) ?? {
    behaviour: { ...AFTER_RESTART },
    cancelled: false,
    finished: false,
  }
  runs.set(remoteJobId, run)
  return run
}

const OUTCOMES: Record<FakeBehaviour['onCancel'], CancelOutcome> = {
  stop: 'stopped',
  finish: 'finished',
  no_confirm: 'unknown',
}

export function fakeVideo(): VideoProvider {
  return {
    async start(input) {
      const { fail, onCancel, waitMs } = fakeBehaviour()
      const size = `${input.width}x${input.height}`
      const remoteJobId = `fake-video-v1-${Date.now()}-${waitMs}-${size}-${input.durationMs}`
      runs.set(remoteJobId, { behaviour: { fail, onCancel }, cancelled: false, finished: false })
      return { remoteJobId }
    },
    async check(remoteJobId) {
      const run = find(remoteJobId)
      const { fail } = run.behaviour
      if (run.cancelled) return { status: 'cancelled' }
      if (fail) return { status: 'failed', error: { kind: fail, detail: FAKE_FAILURE_DETAIL } }
      const ready = run.finished || Date.now() >= readyAt(remoteJobId)
      return ready ? { status: 'succeeded' } : { status: 'running' }
    },
    async fetchResult(remoteJobId) {
      find(remoteJobId)
      return { bytes: tinyMp4(), mime: 'video/mp4', model: FAKE_VIDEO_MODEL }
    },
    async cancel(remoteJobId) {
      const run = find(remoteJobId)
      const outcome = OUTCOMES[run.behaviour.onCancel]
      if (outcome === 'stopped') run.cancelled = true
      if (outcome === 'finished') run.finished = true
      return outcome
    },
  }
}
