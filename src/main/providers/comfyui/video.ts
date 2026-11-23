// SPEC 6.10.7 [REQ: FR-262, FR-283, FR-286] (security class): VideoProvider for ComfyUI. A
// video from a prompt, a first frame or one reference picture (14 1.60 CU-6b), on the
// workflow for that start pair. start checks the server (6.10.3), uploads the pictures, fills
// and submits; check looks once where
// the run is; fetchResult fetches the SaveVideo file under MAX_VIDEO_BYTES and passes it
// through checkMp4; cancel goes through the own-ID set (14 1.43 K-7). Each run's origin,
// workflow and waits are kept here, so only a run this adapter started is ever asked about.
import { MAX_VIDEO_BYTES } from '@/main/providers/picture-limits'
import {
  ProviderCancelled,
  ProviderFailure,
  type AdapterContext,
  type VideoProvider,
} from '@/main/providers/types'
import { checkMp4 } from '@/main/providers/video-check'
import type { HistoryEntry } from './answers'
import { cancelOwnRun } from './cancel'
import { comfyFailure } from './failures'
import { fillWorkflow } from './fill'
import { frameCount } from './frames'
import { workflowForRun } from './image'
import { LOST_CONTACT_MS, QUEUE_WAIT_MS, VIDEO_WORK_MS } from './limits'
import { serverChecks, type ServerChecks } from './needs'
import { isFailedPoll, look, throughBreaks } from './poll'
import { endedEntry, fillValuesFor, resultRef, submitted, type RunTiming } from './run'
import {
  checked,
  checkList,
  pinnedClient,
  realTiming,
  runLive,
  runOrigin,
  runWorkflows,
} from './session'
import { checkFrameSize, runSizeOf, uploadPictures } from './video-pictures'
import type { WorkflowSpec } from './workflows/types'

export type ComfyVideoDeps = { timing?: RunTiming; checks?: ServerChecks }

type Checked = Awaited<ReturnType<VideoProvider['check']>>

type VideoRun = {
  origin: string
  spec: WorkflowSpec
  serverVersion: string | undefined
  startedAt: number
  workingSince: number | null
  breakSince: number | null
  missed: number
  last: { status: 'waiting' | 'running'; queuePosition?: number }
  entry: HistoryEntry | null
  cancelAsked: boolean
  // CU-9: the last whole percent the live connection gave, and how to stop listening.
  fraction?: number
  stopLive: () => void
}

const NOT_OURS = 'Not a run this app started'

const failed = (e: ProviderFailure): Checked => ({ status: 'failed', error: e.error })

export function comfyVideo(ctx: AdapterContext, deps: ComfyVideoDeps = {}): VideoProvider {
  const timing = deps.timing ?? realTiming
  const checks = deps.checks ?? serverChecks
  const runs = new Map<string, VideoRun>()

  function tooLong(run: VideoRun): boolean {
    const now = timing.now()
    if (run.workingSince === null) return now - run.startedAt > QUEUE_WAIT_MS
    return now - run.workingSince > VIDEO_WORK_MS
  }

  // The history entry of a run that ended: succeeded, or why not.
  function ended(run: VideoRun, entry: HistoryEntry): Checked {
    try {
      endedEntry(entry)
    } catch (e) {
      if (!(e instanceof ProviderFailure)) throw e
      // An interrupted run this adapter was asked to stop was stopped.
      if (run.cancelAsked && e.error.reason === 'server_stopped') return { status: 'cancelled' }
      return failed(e)
    }
    run.entry = entry
    return { status: 'succeeded' }
  }

  // CU-9: a run still going carries the live percent while running; one that ended stops
  // listening.
  function withLive(run: VideoRun, state: Checked): Checked {
    if (state.status === 'running' && run.fraction !== undefined) {
      return { ...state, progress: run.fraction }
    }
    if (state.status !== 'waiting' && state.status !== 'running') run.stopLive()
    return state
  }

  async function looked(run: VideoRun, id: string): Promise<Checked> {
    const seen = await look(pinnedClient(ctx, run.origin), id)
    run.breakSince = null
    if (seen.at === 'history') return ended(run, seen.entry)
    if (seen.at === 'nowhere') {
      run.missed += 1
      if (run.missed < 2) return { ...run.last }
      if (run.cancelAsked) return { status: 'cancelled' }
      return failed(comfyFailure('server_stopped', 'The run is in neither place'))
    }
    run.missed = 0
    if (seen.at === 'working') {
      run.workingSince ??= timing.now()
      run.last = { status: 'running' }
    } else {
      run.last = {
        status: 'waiting',
        ...(seen.queuePosition && { queuePosition: seen.queuePosition }),
      }
    }
    if (tooLong(run)) {
      return failed(comfyFailure('too_long', 'Over the waiting or working limit', 'timeout'))
    }
    return { ...run.last }
  }

  return {
    async start(input, opts = {}) {
      const origin = runOrigin(ctx)
      const references = input.references.length > 0
      const videoStart = { firstFrame: input.image !== null, references }
      const spec = workflowForRun('video', videoStart, runWorkflows(ctx), input.workflowId)
      if (!spec.video) throw new Error(`${spec.id} has no video values`)
      // CW-7: worked out before anything is sent, since it may find no count that fits.
      const frames = frameCount(input.durationMs, spec.video)
      const size = runSizeOf(spec, { width: input.width, height: input.height })
      // [1.60] N-7: before anything is sent, the first frame must state the run size.
      if (input.image) checkFrameSize(input.image, size)
      if (opts.signal?.aborted) throw new ProviderCancelled()
      const live = runLive(ctx, origin)
      const client = pinnedClient(ctx, origin, live)
      const serverVersion = await checked(checks, origin, client, spec, checkList(ctx))
      const pictures = await uploadPictures(client, input, opts.signal)
      const sentId = timing.newId()
      const { prompt, width, height } = input
      const ask = { prompt, width, height, references: pictures.references }
      const values = {
        ...fillValuesFor(spec, ask, sentId),
        frames,
        ...(pictures.firstFrame !== undefined && { firstFrame: pictures.firstFrame }),
      }
      const promptId = await submitted({ client }, fillWorkflow(spec, values), sentId)
      const run: VideoRun = {
        origin,
        spec,
        serverVersion,
        startedAt: timing.now(),
        workingSince: null,
        breakSince: null,
        missed: 0,
        last: { status: 'waiting' },
        entry: null,
        cancelAsked: false,
        stopLive: () => undefined,
      }
      run.stopLive = live.watch(promptId, (seen) => {
        if (seen.fraction !== undefined) run.fraction = seen.fraction
      })
      runs.set(promptId, run)
      return { remoteJobId: promptId }
    },

    async check(remoteJobId) {
      const run = runs.get(remoteJobId)
      if (!run) return failed(comfyFailure('server_stopped', NOT_OURS))
      try {
        return withLive(run, await looked(run, remoteJobId))
      } catch (e) {
        if (!(e instanceof ProviderFailure)) throw e
        if (!isFailedPoll(e)) return withLive(run, failed(e))
        // SPEC 6.10.6 "A short break": a failed poll is not a failure, for 5 minutes.
        run.breakSince ??= timing.now()
        if (timing.now() - run.breakSince < LOST_CONTACT_MS) return withLive(run, { ...run.last })
        const lost = comfyFailure('lost_contact', 'Polls failed for 5 minutes', 'offline')
        return withLive(run, failed(lost))
      }
    },

    async fetchResult(remoteJobId) {
      const run = runs.get(remoteJobId)
      if (!run) throw comfyFailure('server_stopped', NOT_OURS)
      run.stopLive()
      const client = pinnedClient(ctx, run.origin)
      // After a cancel that came too late (`finished`), check has not seen the entry yet.
      const entry = run.entry ?? (await client.history(remoteJobId))
      if (!entry) throw comfyFailure('server_stopped', 'The run left no result')
      endedEntry(entry)
      const ref = resultRef(run.spec, entry)
      const bytes = await throughBreaks(timing, () => client.viewFile(ref, MAX_VIDEO_BYTES))
      try {
        checkMp4(bytes)
      } catch {
        throw comfyFailure('bad_result', 'The result failed the MP4 check')
      }
      return { bytes, mime: 'video/mp4', model: run.spec.model.mainFile }
    },

    async cancel(remoteJobId) {
      const run = runs.get(remoteJobId)
      if (!run) return 'unknown'
      run.cancelAsked = true
      run.stopLive()
      return cancelOwnRun(pinnedClient(ctx, run.origin), remoteJobId, run.serverVersion)
    },

    // [1.60] N-6: the size fillValuesFor will send for this start pair.
    runSize(width, height, videoStart, workflowId) {
      const spec = workflowForRun('video', videoStart, runWorkflows(ctx), workflowId)
      return runSizeOf(spec, { width, height })
    },
  }
}
