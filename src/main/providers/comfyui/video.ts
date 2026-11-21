// SPEC 6.10.7 [REQ: FR-262, FR-283, FR-286] (security class): VideoProvider for ComfyUI, in
// CU-6a's form: a video from a prompt alone, on the workflow for "no first frame, no
// references". start checks the server (6.10.3), fills and submits; check looks once where
// the run is; fetchResult fetches the SaveVideo file under MAX_VIDEO_BYTES and passes it
// through checkMp4; cancel goes through the own-ID set (14 1.43 K-7). Each run's origin,
// workflow and waits are kept here, so only a run this adapter started is ever asked about.
import { MAX_VIDEO_BYTES } from '../picture-limits'
import { ProviderFailure, type AdapterContext, type VideoProvider } from '../types'
import { checkMp4 } from '../video-check'
import type { HistoryEntry } from './answers'
import { cancelOwnRun } from './cancel'
import { comfyFailure } from './failures'
import { fillWorkflow } from './fill'
import { frameCount } from './frames'
import { workflowForRun } from './image'
import { LOST_CONTACT_MS, QUEUE_WAIT_MS, VIDEO_WORK_MS } from './limits'
import { serverChecks, type ServerChecks } from './needs'
import { isBreak, look, throughBreaks } from './poll'
import { endedEntry, fillValuesFor, resultRef, submitted, type RunTiming } from './run'
import { checked, pinnedClient, realTiming, runOrigin } from './session'
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
    async start(input) {
      // CU-6b brings the first frame and references; the command refuses them before a job.
      if (input.image !== null || input.references.length > 0) {
        throw new Error('A ComfyUI video from a first frame or references is not built yet')
      }
      const origin = runOrigin(ctx)
      const spec = workflowForRun('video', { firstFrame: false, references: false })
      if (!spec.video) throw new Error(`${spec.id} has no video values`)
      const client = pinnedClient(ctx, origin)
      const serverVersion = await checked(checks, origin, client, spec)
      const sentId = timing.newId()
      const ask = { prompt: input.prompt, width: input.width, height: input.height, references: [] }
      const values = {
        ...fillValuesFor(spec, ask, sentId),
        frames: frameCount(input.durationMs, spec.video),
      }
      const promptId = await submitted({ client }, fillWorkflow(spec, values), sentId)
      runs.set(promptId, {
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
      })
      return { remoteJobId: promptId }
    },

    async check(remoteJobId) {
      const run = runs.get(remoteJobId)
      if (!run) return failed(comfyFailure('server_stopped', NOT_OURS))
      try {
        return await looked(run, remoteJobId)
      } catch (e) {
        if (!(e instanceof ProviderFailure)) throw e
        if (!isBreak(e)) return failed(e)
        // SPEC 6.10.6 "A short break": a failed poll is not a failure, for 5 minutes.
        run.breakSince ??= timing.now()
        if (timing.now() - run.breakSince < LOST_CONTACT_MS) return { ...run.last }
        return failed(comfyFailure('lost_contact', 'Polls failed for 5 minutes', 'offline'))
      }
    },

    async fetchResult(remoteJobId) {
      const run = runs.get(remoteJobId)
      if (!run) throw comfyFailure('server_stopped', NOT_OURS)
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
      return cancelOwnRun(pinnedClient(ctx, run.origin), remoteJobId, run.serverVersion)
    },
  }
}
