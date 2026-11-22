// P7-11 (phase-07.md "fal.ai Seedance" and "The format switch and the start"; security class):
// checks of generation.startVideo and job.retry made in prepare, before any picture is read,
// any provider is called or any job row is made. For a provider with an offer (A-175): the
// start kind, the length and the reference count. For every provider: the variant is a video
// post, and a background start has a background picture. No sentence holds a path, a key or
// text from a file; a provider is named by its display name.
import type { ProjectHandle } from '@/main/db/project-file'
import { readWireRow } from '@/main/db/rows'
import { startKindOf, type VideoOffer } from '@/shared/config/video-offers'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { VariantRow } from '@/shared/schemas/rows/variant'
import { AppError } from '@/shared/schemas/result'
import { videoLengthRefusal, videoRefusal, videoStartRefusal } from '@/shared/video/messages'
import type { StartFields } from './start-pair'

type OfferAsk = StartFields & { durationMs: number }

const tooManyVideoReferences = (label: string, max: number) =>
  new AppError('RULE_VIOLATION', `${label} takes at most ${max} reference pictures for a video.`, {
    reason: 'too_many_references',
    max,
  })

export function checkVideoOffer(label: string, offer: VideoOffer, ask: OfferAsk): void {
  const kind = startKindOf(ask)
  if (kind === null || !offer.starts.includes(kind)) throw videoStartRefusal(label)
  const { minMs, maxMs, stepMs } = offer
  const ms = ask.durationMs
  if (ms < minMs || ms > maxMs || (ms - minMs) % stepMs !== 0) {
    throw videoLengthRefusal(label, minMs / 1000, maxMs / 1000)
  }
  if (kind === 'reference' && ask.referenceAssetIds.length > offer.maxReferences) {
    throw tooManyVideoReferences(label, offer.maxReferences)
  }
}

function hasBackgroundPicture(project: ProjectHandle, variantId: string): boolean {
  const found = project.db
    .prepare(`SELECT id FROM layer WHERE variant_id = ? AND type = 'background' LIMIT 1`)
    .get(variantId) as { id: string } | undefined
  if (!found) return false
  const layer = readWireRow(project.db, 'layer', { id: found.id }) as LayerRow | null
  return layer?.source != null
}

// [A-176] Every provider: a video post, and for a background start a background picture.
export function checkVideoTarget(
  project: ProjectHandle,
  variantId: string,
  start: StartFields['start'],
): void {
  const variant = readWireRow(project.db, 'variant', { id: variantId }) as VariantRow | null
  if (!variant) throw new AppError('NOT_FOUND', 'That variant was not found.')
  if (variant.format !== 'video') throw videoRefusal('video_needs_video_post')
  if (start !== 'background') return
  if (!hasBackgroundPicture(project, variantId)) throw videoRefusal('background_empty')
  // The background is drawn into a first frame by P7-16; until then the start is refused.
  throw videoRefusal('video_not_built')
}
