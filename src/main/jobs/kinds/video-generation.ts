// The video_generation job kind, first form (SPEC 6.10.7 "Into the project", 6.11.1, 6.11.2;
// 14 1.40, 1.41 CU-6a). start once, store its ID with setRemoteJobId, check on a timer, then
// fetch the clip, check it with checkMp4, write it with writeManaged and add it with
// asset.addGenerated. No clip is put on a track (Phase 7).
// [1.40] (security class, cost): a row that already has a remote ID is only checked and
// fetched; start is never called for it, so a row the app did not make cannot start work.
import { ulid } from 'ulid'
import type { JobKindHandler, JobRunContext } from '@/main/jobs/types'
import { cancelWaitFor } from '@/main/jobs/cancel-wait'
import type { CoreDeps } from '@/main/core-deps'
import type { ProjectHandle } from '@/main/db/project-file'
import { adapterFor } from '@/main/providers/adapters'
import { requireProviderKeys } from '@/main/providers/require-keys'
import {
  ProviderCancelled,
  ProviderFailure,
  type ImageFile,
  type VideoProvider,
  type VideoResult,
} from '@/main/providers/types'
import { checkMp4 } from '@/main/providers/video-check'
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

type Run = { jc: JobRunContext; provider: VideoProvider; providerId: string; pollMs: number }

const pause = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((done) => {
    const timer = setTimeout(done, ms)
    signal?.addEventListener('abort', () => (clearTimeout(timer), done()), { once: true })
  })

const projectGone = (jc: JobRunContext) => !jc.deps.projects.get(jc.projectId)

// [1.60] N-6: the pictures, read again. A first frame is fitted to the run size, PNG out; a
// reference is sent as read.
async function pictures(run: Run, project: ProjectHandle, request: VideoJobRequest) {
  const { jc, provider } = run
  const files: ImageFile[] = []
  for (const id of request.referenceAssetIds) files.push(await jc.deps.assets.read(project, id))
  const [frame] = files
  if (request.start !== 'first_frame' || !frame) return { image: null, references: files }
  const { width, height } = request
  const videoStart = { firstFrame: true, references: false }
  const size = provider.runSize?.(width, height, videoStart) ?? { width, height }
  const image = { bytes: jc.deps.fitPicture(frame.bytes, size), mime: 'image/png' }
  return { image, references: [] }
}

async function started(run: Run, project: ProjectHandle, request: VideoJobRequest) {
  const { jc, provider } = run
  const input = {
    ...(await pictures(run, project, request)),
    prompt: promptToSend(request.prompt),
    durationMs: request.durationMs,
    width: request.width,
    height: request.height,
  }
  const { remoteJobId } = await jc.call(() => provider.start(input, { signal: jc.signal }))
  jc.setRemoteJobId(remoteJobId)
  return remoteJobId
}

// Waits until the run has a result. Ends with ProviderCancelled when it was stopped, and with
// the provider's failure when it failed. SPEC 6.11.2: when the signal fires, the provider's
// cancel is called once; `unknown` keeps checking, for at most the provider's cancel wait.
async function untilDone(run: Run, remoteJobId: string): Promise<void> {
  const { jc, provider } = run
  let cancelSentAt: number | null = null
  for (;;) {
    await pause(run.pollMs, cancelSentAt === null ? jc.signal : undefined)
    if (projectGone(jc)) throw new ProviderCancelled()
    if (jc.signal.aborted && cancelSentAt === null) {
      cancelSentAt = Date.now()
      const outcome = await provider.cancel(remoteJobId)
      if (outcome === 'stopped') throw new ProviderCancelled()
      if (outcome === 'finished') return
    }
    if (cancelSentAt !== null && Date.now() - cancelSentAt > cancelWaitFor(run.providerId)) {
      throw new ProviderCancelled()
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

// SPEC 6.10.7: the clip as the provider sent it, after checkMp4 (OI-36 default).
async function stored(
  jc: JobRunContext,
  job: JobRow,
  project: ProjectHandle,
  result: VideoResult,
): Promise<VideoJobResult> {
  let facts: ReturnType<typeof checkMp4>
  try {
    facts = checkMp4(result.bytes)
  } catch {
    const detail = 'The result failed the MP4 check'
    throw new ProviderFailure({ kind: 'other', reason: 'bad_result', detail })
  }
  if (projectGone(jc)) throw new ProviderCancelled()
  const assetId = ulid()
  await jc.deps.assets.writeManaged(project, { assetId, ext: 'mp4', bytes: result.bytes })
  const files = [{ assetId, ext: 'mp4' }]
  // [1.58] J-4: the asset row keeps the model the result names (SPEC 6.6).
  const added = await jc.system('asset.addGenerated', {
    projectId: jc.projectId,
    jobId: job.id,
    files,
    ...(result.model && { model: result.model }),
  })
  if (!added.ok) throw new Error(`asset.addGenerated refused: ${added.error.code}`)
  return { assetId, ...facts, details: 'pending' }
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
  const run: Run = { jc, provider: opts.videoFor(jc.deps, providerId), providerId, ...opts }
  if (job.remoteJobId === null && jc.cancelled()) throw new ProviderCancelled()
  const remoteJobId = job.remoteJobId ?? (await started(run, project, request))
  await untilDone(run, remoteJobId)
  return stored(jc, job, project, await run.provider.fetchResult(remoteJobId))
}

const defaultVideoFor: VideoAdapterFor = (deps, providerId) => adapterFor(deps, providerId, 'video')

export function videoGenerationKind(opts: VideoKindOptions = {}): JobKindHandler {
  const full = { videoFor: opts.videoFor ?? defaultVideoFor, pollMs: opts.pollMs ?? VIDEO_POLL_MS }
  return { kind: 'video_generation', run: (jc, job) => runVideoJob(jc, job, full) }
}
