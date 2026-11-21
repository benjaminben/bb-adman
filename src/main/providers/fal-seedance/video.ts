// phase-07 "fal.ai Seedance" (A-170 to A-174, security class): VideoProvider for fal's queue
// API, four HTTPS calls through the pinned wrapper. Only `start` sends a picture or a prompt,
// and only in the submit body; the job kind calls it inside jc.call, so only the submit counts
// as a paid call (A-173). Status, result and cancel addresses are built from the request ID;
// the one address taken from an answer, the finished video, must be on a media host. The
// download is read under MAX_VIDEO_BYTES and must pass checkMp4 by its own bytes.
import {
  ProviderCancelled,
  ProviderFailure,
  type AdapterContext,
  type VideoProvider,
} from '@/main/providers/types'
import { checkMp4 } from '@/main/providers/video-check'
import { submitFor } from './endpoints'
import { pinnedFal, type FalAnswer, type FalSend } from './fal-fetch'
import { falHttpFailure, falThrownFailure } from './failure'
import { FAL_QUEUE_ORIGIN } from './origins'
import {
  BAD_ID,
  cancelOutcome,
  checkedFrom,
  isRequestId,
  readJson,
  requestAddress,
  resultAnswer,
  submitAnswer,
  type Checked,
} from './status'

// spec/providers-adapters.md: the whole run, from the first time this adapter sees it.
export const FAL_RUN_MS = 15 * 60_000
// One JSON call, and the video download.
export const CALL_MS = 120_000
export const DOWNLOAD_MS = 600_000

export type FalVideoDeps = { fetch?: typeof fetch; now?: () => number; callMs?: number }

type Run = { endpoint?: string; firstSeen: number; last: Checked }

const isOk = (answer: FalAnswer) => answer.status >= 200 && answer.status <= 299
const badId = () => new ProviderFailure({ kind: 'other', detail: BAD_ID })
const failed = (e: ProviderFailure): Checked => ({ status: 'failed', error: e.error })

export function falVideo(ctx: AdapterContext, deps: FalVideoDeps = {}): VideoProvider {
  const inner: typeof fetch = deps.fetch ?? ((input, init) => fetch(input, init))
  const now = deps.now ?? Date.now
  const callMs = deps.callMs ?? CALL_MS
  const runs = new Map<string, Run>()

  // One call under its own timer. The key is read inside the `try`, and every error leaves
  // as a ProviderFailure with a clean detail.
  async function call<T>(
    ms: number,
    work: (fal: FalSend, signal: AbortSignal, key: string) => Promise<T>,
  ): Promise<T> {
    let key = ''
    const timer = new AbortController()
    const handle = setTimeout(() => timer.abort(), ms)
    try {
      key = ctx.secret('fal.apiKey')
      return await work(pinnedFal(inner, key), timer.signal, key)
    } catch (error) {
      const timedOut = timer.signal.aborted && !(error instanceof ProviderFailure)
      throw falThrownFailure(error, timedOut, key)
    } finally {
      clearTimeout(handle)
    }
  }

  function runOf(id: string): Run {
    let run = runs.get(id)
    if (!run) {
      run = { firstSeen: now(), last: { status: 'waiting' } }
      runs.set(id, run)
    }
    return run
  }

  async function status(id: string): Promise<Checked> {
    try {
      return await call(callMs, async (fal, signal, key) => {
        const answer = await fal.send(requestAddress(id, 'status'), { method: 'GET', signal })
        return checkedFrom(answer, key)
      })
    } catch (error) {
      if (!(error instanceof ProviderFailure)) throw error
      // A short break is not a failure: the run limit below still ends it.
      const kind = error.error.kind
      if (kind === 'offline' || kind === 'timeout') return runOf(id).last
      return failed(error)
    }
  }

  return {
    async start(input, opts = {}) {
      if (opts.signal?.aborted) throw new ProviderCancelled()
      const { endpoint, body } = submitFor(input)
      if (opts.signal?.aborted) throw new ProviderCancelled()
      // Once sent, the submit is not aborted by the run signal: its ID must come back so the
      // job can send the queue cancel.
      const id = await call(callMs, async (fal, signal, key) => {
        const address = `${FAL_QUEUE_ORIGIN}/${endpoint}`
        const answer = await fal.send(address, { method: 'POST', body, signal })
        if (!isOk(answer)) throw falHttpFailure(answer, key)
        const { request_id } = readJson(answer, submitAnswer)
        if (!isRequestId(request_id)) throw badId()
        return request_id
      })
      runs.set(id, { endpoint, firstSeen: now(), last: { status: 'waiting' } })
      return { remoteJobId: id }
    },

    async check(remoteJobId) {
      if (!isRequestId(remoteJobId)) return failed(badId())
      const run = runOf(remoteJobId)
      const state = await status(remoteJobId)
      if (state.status !== 'waiting' && state.status !== 'running') return state
      run.last = state
      if (now() - run.firstSeen <= FAL_RUN_MS) return state
      return { status: 'failed', error: { kind: 'timeout', detail: 'No result within 15 minutes' } }
    },

    async fetchResult(remoteJobId) {
      if (!isRequestId(remoteJobId)) throw badId()
      const address = await call(callMs, async (fal, signal, key) => {
        const answer = await fal.send(requestAddress(remoteJobId, 'result'), {
          method: 'GET',
          signal,
        })
        if (!isOk(answer)) throw falHttpFailure(answer, key)
        return readJson(answer, resultAnswer).video.url
      })
      const bytes = await call(DOWNLOAD_MS, async (fal, signal, key) => {
        const answer = await fal.download(address, signal)
        if (!isOk(answer)) throw falHttpFailure(answer, key)
        return answer.bytes
      })
      try {
        checkMp4(bytes)
      } catch {
        const detail = 'The result failed the MP4 check'
        throw new ProviderFailure({ kind: 'other', reason: 'bad_result', detail })
      }
      // The endpoint this adapter started it on; a picked-up run reports the registry model.
      const model = runs.get(remoteJobId)?.endpoint ?? ctx.model('video')
      return { bytes, mime: 'video/mp4', model }
    },

    async cancel(remoteJobId) {
      if (!isRequestId(remoteJobId)) return 'unknown'
      try {
        return await call(callMs, async (fal, signal) => {
          const answer = await fal.send(requestAddress(remoteJobId, 'cancel'), {
            method: 'PUT',
            signal,
          })
          return cancelOutcome(answer)
        })
      } catch {
        return 'unknown'
      }
    },
  }
}
