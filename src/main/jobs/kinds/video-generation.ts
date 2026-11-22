// The video_generation job kind (SPEC 6.10.7 "Into the project", 6.11.1, 6.11.2; 14 1.40,
// 1.41 CU-6a; P7-16). start once, store its ID with setRemoteJobId, check on a timer, then
// fetch the clip and hand it to storeVideo (video-store.ts): details embedded, stored with its
// facts, put on the variant's track. A `background` start draws its first frame from the
// variant's background at job time (background-frame.ts).
// [1.40] (security class, cost): a row that already has a remote ID is only checked and
// fetched; start is never called for it, so a row the app did not make cannot start work.
// P7-13, P7-16: once the runner lets the job go on a close, this handler sends nothing more.
import type { JobKindHandler, JobRunContext } from '@/main/jobs/types'
import { backgroundFrame } from '@/main/jobs/background-frame'
import { readPictures } from '@/main/jobs/read-pictures'
import { runGone, storeVideo } from '@/main/jobs/video-store'
import type { CoreDeps } from '@/main/core-deps'
import type { ProjectHandle } from '@/main/db/project-file'
import { adapterFor } from '@/main/providers/adapters'
import { requireProviderKeys } from '@/main/providers/require-keys'
import { ProviderCancelled, ProviderFailure, type VideoProvider } from '@/main/providers/types'
import { promptToSend } from '@/shared/generation/prompt'
import type { JobRow } from '@/shared/schemas/rows/job'
import {
  videoJobRequest,
  type VideoJobRequest,
  type VideoJobResult,
} from '@/shared/schemas/jobs/video-generation'

// How often the job asks the provider where the run is.
export const VIDEO_POLL_MS = 2_000

export type VideoAdapterFor = (deps: CoreDeps, providerId: string) => VideoProvider
export type VideoKindOptions = { videoFor?: VideoAdapterFor; pollMs?: number }

type Run = {
  jc: JobRunContext
  job: JobRow
  project: ProjectHandle
  provider: VideoProvider
  pollMs: number
}

const pause = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((done) => {
    const timer = setTimeout(done, ms)
    signal?.addEventListener('abort', () => (clearTimeout(timer), done()), { once: true })
  })

const sentPrompt = (request: VideoJobRequest) =>
  promptToSend(request.prompt, { pictures: request.referenceAssetIds.length })

// [1.60] N-6: the pictures, read again. A first frame (a picture, or the variant's background
// drawn now) is fitted to the run size, PNG out; a reference is sent as read.
async function pictures(run: Run, request: VideoJobRequest) {
  const { jc, provider, project } = run
  const { width, height } = request
  const videoStart = { firstFrame: true, references: false }
  const size = () => provider.runSize?.(width, height, videoStart) ?? { width, height }
  if (request.start === 'background') {
    const bytes = await backgroundFrame(jc, project, run.job.variantId, size())
    return { image: { bytes, mime: 'image/png' as const }, references: [] }
  }
  const files = await readPictures(jc, project, request.referenceAssetIds)
  const [frame] = files
  if (request.start !== 'first_frame' || !frame) return { image: null, references: files }
  const image = { bytes: jc.deps.fitPicture(frame.bytes, size()), mime: 'image/png' as const }
  return { image, references: [] }
}

async function started(run: Run, request: VideoJobRequest) {
  const { jc, provider } = run
  const input = {
    ...(await pictures(run, request)),
    prompt: sentPrompt(request),
    durationMs: request.durationMs,
    width: request.width,
    height: request.height,
  }
  const { remoteJobId } = await jc.call(() => provider.start(input, { signal: jc.signal }))
  jc.setRemoteJobId(remoteJobId)
  return remoteJobId
}

// Waits until the run has a result. Ends with ProviderCancelled when it was stopped or let go,
// and with the provider's failure when it failed. SPEC 6.11.2: when the signal fires, the
// provider's cancel is called once; `unknown` keeps checking until the run ends or the
// runner's cancel wait ends the job (LP-2: the runner's timer is the one owner of that wait).
async function untilDone(run: Run, remoteJobId: string): Promise<void> {
  const { jc, provider } = run
  let cancelSent = false
  for (;;) {
    await pause(run.pollMs, cancelSent ? undefined : jc.signal)
    if (runGone(jc, run.project) || jc.ended?.()) throw new ProviderCancelled()
    if (jc.signal.aborted && !cancelSent) {
      cancelSent = true
      const outcome = await provider.cancel(remoteJobId)
      if (outcome === 'stopped') throw new ProviderCancelled()
      if (outcome === 'finished') return
    }
    const state = await provider.check(remoteJobId)
    if (state.status === 'succeeded') return
    if (state.status === 'failed') {
      throw new ProviderFailure(state.error ?? { kind: 'other', detail: 'The run failed' })
    }
    if (state.status === 'cancelled') {
      if (jc.cancelled()) throw new ProviderCancelled()
      throw new ProviderFailure({ kind: 'other', detail: 'The provider ended the run' })
    }
    jc.onProgress(
      state.status === 'waiting'
        ? { stage: 'waiting', ...(state.queuePosition && { queuePosition: state.queuePosition }) }
        : { stage: 'working', ...(state.progress !== undefined && { fraction: state.progress }) },
    )
  }
}

async function runVideoJob(
  jc: JobRunContext,
  job: JobRow,
  opts: Required<VideoKindOptions>,
): Promise<VideoJobResult> {
  const request = videoJobRequest.parse(job.request)
  const providerId = job.provider ?? ''
  const project = jc.deps.projects.get(jc.projectId)
  if (!project) throw new ProviderCancelled()
  requireProviderKeys(jc.deps, providerId, 'make videos')
  const provider = opts.videoFor(jc.deps, providerId)
  const run: Run = { jc, job, project, provider, pollMs: opts.pollMs }
  if (job.remoteJobId === null && jc.cancelled()) throw new ProviderCancelled()
  const remoteJobId = job.remoteJobId ?? (await started(run, request))
  await untilDone(run, remoteJobId)
  if (runGone(jc, project)) throw new ProviderCancelled()
  const result = await provider.fetchResult(remoteJobId)
  return storeVideo({ jc, job, project, prompt: sentPrompt(request) }, result)
}

const defaultVideoFor: VideoAdapterFor = (deps, providerId) => adapterFor(deps, providerId, 'video')

export function videoGenerationKind(opts: VideoKindOptions = {}): JobKindHandler {
  const full = { videoFor: opts.videoFor ?? defaultVideoFor, pollMs: opts.pollMs ?? VIDEO_POLL_MS }
  return { kind: 'video_generation', run: (jc, job) => runVideoJob(jc, job, full) }
}
