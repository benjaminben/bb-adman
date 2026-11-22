// Making one clip for "Update gallery" (round-2-approvals-video.md "Making one clip"). Security
// class full. The clip is exported with the unchanged Phase 8 code (deps.export.video, whose
// one FFmpeg runner is src/main/media/run-ffmpeg.ts) into a work folder of its own,
// export-work/{ULID}, which is removed on every path; the written file is opened without
// following a link, checked to be a regular file and streamed to the store. No path or signed
// address reaches a log line or an error: errors are fixed sentences with the variant's ID.
import { constants } from 'node:fs'
import fs from 'node:fs/promises'
import { Readable } from 'node:stream'
import { ulid } from 'ulid'
import type { CoreDeps } from '@/main/core-deps'
import type { ProjectHandle } from '@/main/db/project-file'
import { exportTarget } from '@/main/export/target'
import type { ExportPlan } from '@/main/export/types'
import { makeWorkDir } from '@/main/export/video/work-dir'
import { LocalFailure } from '@/main/jobs/local-failure'
import type { JobRunContext } from '@/main/jobs/types'
import { sceneInput } from '@/main/thumbnails/scene-input'
import { CLIP_MAX_BYTES, CLIP_MAX_MS } from '@/shared/approvals/contract'
import {
  approvalsRefusal,
  clipFailedMessage,
  variantChangedMessage,
} from '@/shared/approvals/messages'
import { clipPath } from '@/shared/approvals/picture-paths'
import { adPath } from '@/shared/export/output-paths'
import type { VariantRow } from '@/shared/schemas/rows/variant'
import { AppError } from '@/shared/schemas/result'

export type ClipMissing = 'no_tool' | 'too_long' | 'too_large'
export type ClipMade = { file: string; durationMs: number; bytes: number }

export type ClipJob = {
  project: ProjectHandle
  pair: { projectId: string; campaignId: string }
  variant: VariantRow
  // The rev the still was drawn at.
  rev: number
  signal: AbortSignal
  // Uploads the clip; a storage failure is the store's PROVIDER_ERROR.
  put(file: string, data: ReadableStream<Uint8Array>): Promise<void>
  // Called just before the upload.
  sending(): void
  // One warn line by step and error kind.
  logStep(step: 'clipMake' | 'clipUpload', error: unknown): void
}

const SYSTEMS: ReadonlySet<NodeJS.Platform> = new Set(['darwin', 'win32'])
const NO_FOLLOW = constants.O_NOFOLLOW ?? 0

const failed = (v: VariantRow) =>
  new AppError('RULE_VIOLATION', clipFailedMessage(v.title), {
    reason: 'clip_failed',
    variantId: v.id,
  })

export function stopIfAsked(signal: AbortSignal): void {
  if (signal.aborted) throw approvalsRefusal('publish_cancelled')
}

// Steps 1 and 2: the reason a clip cannot be made, before anything runs; null when it can.
export function clipBlocked(deps: Pick<CoreDeps, 'media'>, v: VariantRow): ClipMissing | null {
  if (!deps.media.available() || !SYSTEMS.has(process.platform)) return 'no_tool'
  if (v.durationMs > CLIP_MAX_MS) return 'too_long'
  return null
}

// A context made like publishContext (src/main/publish/export-adapter.ts): the run's signal,
// no provider call and no command, the rest no-ops.
function clipContext(deps: CoreDeps, projectId: string, signal: AbortSignal): JobRunContext {
  const refused = () => Promise.reject(new LocalFailure('export_failed'))
  return {
    deps,
    projectId,
    signal,
    call: refused,
    progress: () => undefined,
    cancelled: () => signal.aborted,
    system: refused,
    onProgress: () => undefined,
    setRemoteJobId: () => undefined,
    keep: () => undefined,
  }
}

// Steps 4 to 6: the export into `root`; gives the written file's path on disk.
async function exportInto(deps: CoreDeps, job: ClipJob, root: string): Promise<string> {
  const v = job.variant
  const scene = await sceneInput(deps, job.project, v.id)
  if (!scene || scene.rev !== job.rev) {
    throw new AppError('RULE_VIOLATION', variantChangedMessage(v.title), {
      reason: 'variant_changed',
      variantId: v.id,
    })
  }
  if (Object.values(scene.input.assets).some((a) => a.missing)) throw failed(v)
  const { imageFormat, jpgQuality, fps } = deps.settings.get().export
  const plan: ExportPlan = {
    projectId: job.pair.projectId,
    campaignId: job.pair.campaignId,
    root,
    variantIds: [v.id],
    imageFormat,
    jpgQuality,
    fps,
    warningsSeen: [],
    proceeded: null,
  }
  const jc = clipContext(deps, job.pair.projectId, job.signal)
  try {
    const { title, sizeLabel, language } = v
    const file = adPath({
      campaignId: plan.campaignId,
      title,
      sizeLabel,
      language,
      variantId: v.id,
      ext: 'mp4',
    })
    const target = exportTarget(root)
    await deps.export.video.exportVariant(jc, scene.input, plan, target, file)
    stopIfAsked(job.signal)
    return target.fullPath(file)
  } catch (error) {
    stopIfAsked(job.signal)
    job.logStep('clipMake', error)
    throw failed(v)
  }
}

// Steps 7 and 8: the size check and the upload.
async function send(job: ClipJob, onDisk: string): Promise<ClipMade | 'too_large'> {
  const v = job.variant
  const handle = await fs.open(onDisk, constants.O_RDONLY | NO_FOLLOW).catch(() => {
    throw failed(v)
  })
  try {
    const stats = await handle.stat()
    if (!stats.isFile() || stats.size < 1) throw failed(v)
    if (stats.size > CLIP_MAX_BYTES) return 'too_large'
    stopIfAsked(job.signal)
    const file = clipPath(job.pair.projectId, job.pair.campaignId, v.id, job.rev)
    job.sending()
    const stream = Readable.toWeb(handle.createReadStream({ autoClose: false }))
    await job.put(file, stream as ReadableStream<Uint8Array>).catch((error: unknown) => {
      job.logStep('clipUpload', error)
      throw error
    })
    return { file, durationMs: v.durationMs, bytes: stats.size }
  } finally {
    await handle.close().catch(() => undefined)
  }
}

// One clip, made and uploaded, or the reason it was sent as a still only.
export async function makeClip(deps: CoreDeps, job: ClipJob): Promise<ClipMade | ClipMissing> {
  const blocked = clipBlocked(deps, job.variant)
  if (blocked) return blocked
  if (job.variant.durationMs < 1) throw failed(job.variant)
  const work = await makeWorkDir(deps.userDataDir, ulid()).catch(() => {
    throw failed(job.variant)
  })
  try {
    return await send(job, await exportInto(deps, job, work.path))
  } finally {
    await work.remove()
  }
}
