// P7-16 (SPEC 6.10.7 "Into the project"; phase-07.md "Clip facts, FFmpeg and the details",
// "Clips and the track"): a finished video run into the ad. The clip passes checkMp4; the
// media tool writes the generation details into it, and the written clip must pass checkMp4
// again with the same facts, else the provider's clip is kept (`details: 'pending'`, not a job
// failure). The file is stored with its facts on the asset row, then clip.addGenerated puts it
// on the job's variant at the first free position. A variant that is gone gives clipId null.
// No path, standard error text or provider's words reach the row, a log line or an event.
import type { JobRunContext } from '@/main/jobs/types'
import type { ProjectHandle } from '@/main/db/project-file'
import { storeResult } from '@/main/jobs/store-result'
import { ProviderCancelled, ProviderFailure, type VideoResult } from '@/main/providers/types'
import { checkMp4, type Mp4Details } from '@/main/providers/video-check'
import type { JobRow } from '@/shared/schemas/rows/job'
import type { VideoJobResult } from '@/shared/schemas/jobs/video-generation'

// spec/export-and-checks.md "Embedded generation details", and nothing else: no key, no path,
// no account data, no server address.
export type VideoDetails = {
  app: 'Adman'
  appVersion: string
  provider: string
  model: string
  prompt: string
  kind: 'video_generation'
  createdAt: string
}

type Stored = { jc: JobRunContext; job: JobRow; project: ProjectHandle; prompt: string }

// True once this handler must stop: the project closed (or was opened again under a new
// handle), or the runner let the job go (P7-13 leaveRunning ends it without a stop signal).
export function runGone(jc: JobRunContext, project: ProjectHandle): boolean {
  if (jc.deps.projects.get(jc.projectId) !== project) return true
  return jc.cancelled() && !jc.signal.aborted
}

function factsOf(bytes: Uint8Array): Mp4Details | null {
  try {
    return checkMp4(bytes)
  } catch {
    return null
  }
}

const sameFacts = (a: Mp4Details, b: Mp4Details) =>
  a.width === b.width &&
  a.height === b.height &&
  a.durationMs === b.durationMs &&
  a.hasSound === b.hasSound

function warn(run: Stored, name: string, reason: string, message: string): void {
  run.jc.deps.log.write({
    level: 'warn',
    event: 'job',
    name,
    actor: 'system',
    projectId: run.jc.projectId,
    jobId: run.job.id,
    ok: false,
    errorKind: reason,
    message,
  })
}

// The clip with its details written in, or null to keep the provider's clip.
async function embedded(run: Stored, result: VideoResult, facts: Mp4Details) {
  const { jc, job } = run
  const details: VideoDetails = {
    app: 'Adman',
    appVersion: jc.deps.appVersion,
    provider: job.provider ?? '',
    model: result.model,
    prompt: run.prompt,
    kind: 'video_generation',
    createdAt: jc.deps.now().toISOString(),
  }
  const skipped = (reason: string) => {
    warn(run, 'media.embed', reason, `The generation details were not written (${reason}).`)
    return null
  }
  let out: Uint8Array | null
  try {
    out = await jc.deps.media.embedDetails({ bytes: result.bytes, details })
  } catch {
    return skipped('run_failed')
  }
  if (!out) return null
  const after = factsOf(out)
  return after && sameFacts(facts, after) ? out : skipped('output_differs')
}

async function placed(run: Stored, assetId: string): Promise<string | null> {
  const { jc, job } = run
  if (!job.variantId) return null
  const input = { projectId: jc.projectId, variantId: job.variantId, assetId }
  const added = await jc.system('clip.addGenerated', input)
  if (!added.ok) {
    warn(run, 'clip.addGenerated', 'clip_not_added', 'A generated clip was not put on the track.')
    return null
  }
  return (added.data as { clipId: string | null }).clipId
}

export async function storeVideo(run: Stored, result: VideoResult): Promise<VideoJobResult> {
  const { jc, job, project } = run
  const facts = factsOf(result.bytes)
  if (!facts) {
    const detail = 'The result failed the MP4 check'
    throw new ProviderFailure({ kind: 'other', reason: 'bad_result', detail })
  }
  if (runGone(jc, project)) throw new ProviderCancelled()
  const written = await embedded(run, result, facts)
  if (runGone(jc, project)) throw new ProviderCancelled()
  const { width, height, durationMs } = facts
  const file = {
    jobId: job.id,
    bytes: written ?? result.bytes,
    ext: 'mp4',
    model: result.model,
    video: { width, height, durationMs },
  }
  const assetId = await storeResult(jc, project, file)
  const clipId = await placed(run, assetId)
  return { assetId, ...facts, details: written ? 'embedded' : 'pending', clipId }
}
