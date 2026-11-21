// SPEC 14 1.60 CU-6b N-4 step 2 (security class): the start fields of generation.startVideo,
// and of a stored video request on job.retry, give one of three start pairs. A prompt alone;
// one first-frame picture; or reference pictures. Every other shape is refused here, before
// any picture is read or any job row is made. How many references a run takes is checked
// against its workflow later.
import { videoNotOffered } from './comfy-video-checks'
import type { VideoStart } from '@/main/providers/types'
import { AppError } from '@/shared/schemas/result'

export type StartFields = {
  start: 'none' | 'first_frame'
  useReferences: boolean
  referenceAssetIds: readonly string[]
}

const choosePicture = () => new AppError('INVALID_INPUT', 'Choose one picture for this video.')

export function startPair(fields: StartFields): VideoStart {
  const count = fields.referenceAssetIds.length
  const firstFrame = fields.start === 'first_frame'
  if (firstFrame && fields.useReferences) throw videoNotOffered()
  if (firstFrame && count !== 1) throw choosePicture()
  if (fields.useReferences && count === 0) throw choosePicture()
  if (!firstFrame && !fields.useReferences && count > 0) throw choosePicture()
  return { firstFrame, references: fields.useReferences }
}
