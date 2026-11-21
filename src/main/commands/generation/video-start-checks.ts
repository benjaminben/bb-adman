// SPEC 14 1.60 CU-6b N-4 and N-5 (security class): the start checks of generation.startVideo,
// made in prepare before any job row, and the same checks for job.retry of a ComfyUI video
// row, against the old row's request and picture IDs. The start pair; for ComfyUI the
// address, the workflow offered for that pair and its length; how many references that
// workflow takes; each picture, which must be a picture the app can read; last the
// licence check (S2-4), so the user confirms only a run that can start.
import type { CoreDeps } from '@/main/core-deps'
import type { PrepareContext } from '@/main/commands/types'
import { readWireRow } from '@/main/db/rows'
import type { ProjectHandle } from '@/main/db/project-file'
import { checkComfyVideo, videoNotOffered } from './comfy-video-checks'
import { tooManyReferences } from './comfy-checks'
import { checkLicence } from './licence-check'
import { startPair, type StartFields } from './start-pair'
import { videoJobRequest } from '@/shared/schemas/jobs/video-generation'
import type { AssetRow } from '@/shared/schemas/rows/asset'
import { AppError } from '@/shared/schemas/result'

type Deps = Pick<CoreDeps, 'devTools' | 'assets'> & {
  settings: Pick<CoreDeps['settings'], 'get'>
}
type Ctx = Pick<PrepareContext, 'actor' | 'project'>
type Ask = StartFields & { durationMs: number; licenceConfirmed?: boolean }

// Slice WP: a WebP is accepted too; assets.read turns every picture into a clean PNG.
const SENDABLE = ['image/png', 'image/jpeg', 'image/webp']

const notUsable = () =>
  new AppError(
    'RULE_VIOLATION',
    'This picture cannot be used for a video yet. Use a PNG, JPEG or WebP.',
    { reason: 'picture_not_usable' },
  )

// N-4 step 4. A row that is not a PNG, JPEG or WebP picture is refused before its file is
// read; assets.read then refuses a picture that is not there, is gone, is too large, or
// cannot be turned into a PNG, as generation.runImages does.
async function usablePicture(deps: Deps, project: ProjectHandle, id: string): Promise<void> {
  const row = readWireRow(project.db, 'asset', { id }) as AssetRow | null
  if (row && (row.kind !== 'image' || !SENDABLE.includes(row.mime))) throw notUsable()
  await deps.assets.read(project, id)
}

export async function checkVideoStart(
  deps: Deps,
  ctx: Ctx,
  providerId: string,
  ask: Ask,
): Promise<void> {
  const videoStart = startPair(ask)
  const picture = videoStart.firstFrame || videoStart.references
  // Every other provider still takes only the prompt start.
  if (providerId !== 'comfyui') {
    if (picture) throw videoNotOffered()
    return
  }
  const spec = checkComfyVideo(deps, ctx, ask.durationMs, videoStart)
  const max = spec.slots.references?.length ?? 0
  if (videoStart.references && ask.referenceAssetIds.length > max) throw tooManyReferences(max)
  for (const id of ask.referenceAssetIds) await usablePicture(deps, ctx.project, id)
  checkLicence(deps, ctx, spec, ask.licenceConfirmed)
}

// N-5: the stored request keeps no useReferences; IDs with start 'none' are references.
export async function checkComfyVideoRetry(
  deps: Deps,
  ctx: Ctx,
  request: unknown,
  licenceConfirmed?: boolean,
) {
  const parsed = videoJobRequest.safeParse(request)
  if (!parsed.success) throw videoNotOffered()
  const { start, referenceAssetIds, durationMs } = parsed.data
  const useReferences = start === 'none' && referenceAssetIds.length > 0
  await checkVideoStart(deps, ctx, 'comfyui', {
    start,
    useReferences,
    referenceAssetIds,
    durationMs,
    licenceConfirmed,
  })
}
