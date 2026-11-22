// SPEC 14 1.60 CU-6b N-4 and N-5 (security class): the start checks of generation.startVideo,
// made in prepare before any job row, and the same checks for job.retry of a video row,
// against the old row's request and picture IDs. P7-11: a provider with an offer (A-175) is
// held to its start kinds, lengths and reference count; then the start pair; then, for every
// provider (A-176), the variant is a video post and a background start has a picture. For
// ComfyUI the address, the workflow offered for that pair and its length, and how many
// references that workflow takes; each picture, which must be a picture the app can read;
// last, for ComfyUI, the licence check (S2-4), so the user confirms only a run that can start.
import type { CoreDeps } from '@/main/core-deps'
import type { PrepareContext } from '@/main/commands/types'
import { readWireRow } from '@/main/db/rows'
import type { ProjectHandle } from '@/main/db/project-file'
import { checkComfyVideo, videoNotOffered } from './comfy-video-checks'
import { tooManyReferences } from './comfy-checks'
import { checkLicence } from './licence-check'
import { startPair, type StartFields } from './start-pair'
import { checkVideoOffer, checkVideoTarget } from './video-offer-checks'
import { videoOffer } from '@/shared/config/video-offers'
import { videoJobRequest } from '@/shared/schemas/jobs/video-generation'
import type { AssetRow } from '@/shared/schemas/rows/asset'
import type { JobRow } from '@/shared/schemas/rows/job'
import { AppError } from '@/shared/schemas/result'
import { videoStartRefusal } from '@/shared/video/messages'

type Deps = Pick<CoreDeps, 'devTools' | 'assets' | 'providers'> & {
  settings: Pick<CoreDeps['settings'], 'get'>
}
type Ctx = Pick<PrepareContext, 'actor' | 'project'>
type Ask = StartFields & { variantId: string; durationMs: number; licenceConfirmed?: boolean }

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

// The provider's display name. A provider that is not available or makes no videos is
// refused; the ID is not echoed, since on job.retry it comes from the project file.
function videoLabel(deps: Deps, providerId: string): string {
  const info = deps.providers.find((p) => p.id === providerId)
  if (!info?.available || !info.jobs.includes('video')) {
    throw new AppError('INVALID_INPUT', 'That provider cannot make videos.')
  }
  return info.label
}

export async function checkVideoStart(
  deps: Deps,
  ctx: Ctx,
  providerId: string,
  ask: Ask,
): Promise<void> {
  const label = videoLabel(deps, providerId)
  const comfy = providerId === 'comfyui'
  const offer = videoOffer(providerId)
  if (offer) checkVideoOffer(label, offer, ask)
  else if (!comfy) throw videoStartRefusal(label)
  const videoStart = startPair(ask)
  checkVideoTarget(ctx.project, ask.variantId, ask.start)
  const spec = comfy ? checkComfyVideo(deps, ctx, ask.durationMs, videoStart) : null
  const max = spec?.slots.references?.length ?? 0
  if (spec && videoStart.references && ask.referenceAssetIds.length > max) {
    throw tooManyReferences(max)
  }
  for (const id of ask.referenceAssetIds) await usablePicture(deps, ctx.project, id)
  if (spec) checkLicence(deps, ctx, spec, ask.licenceConfirmed)
}

// N-5, P7-11: a video row of any provider. The stored request keeps no useReferences; IDs
// with start 'none' are references.
export async function checkVideoRetryRequest(
  deps: Deps,
  ctx: Ctx,
  old: Pick<JobRow, 'provider' | 'variantId' | 'request'>,
  licenceConfirmed?: boolean,
) {
  const providerId = old.provider ?? ''
  const label = videoLabel(deps, providerId)
  const parsed = videoJobRequest.safeParse(old.request)
  if (!parsed.success) throw providerId === 'comfyui' ? videoNotOffered() : videoStartRefusal(label)
  const { start, referenceAssetIds, durationMs } = parsed.data
  const useReferences = start === 'none' && referenceAssetIds.length > 0
  await checkVideoStart(deps, ctx, providerId, {
    variantId: old.variantId ?? '',
    start,
    useReferences,
    referenceAssetIds,
    durationMs,
    licenceConfirmed,
  })
}
