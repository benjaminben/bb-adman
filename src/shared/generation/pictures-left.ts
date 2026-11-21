// FN-4: how many pictures a retry of a picture job asks for. A job that kept pictures (its
// result lists their asset IDs) asks only for the rest, and always for at least one. Shared,
// so job.retry and the run row's paid confirm line count the same way.
import { imageJobResult } from '@/shared/schemas/jobs/image-generation'

const keptIds = imageJobResult.pick({ assetIds: true })

export function keptPictureCount(result: unknown): number {
  const kept = keptIds.safeParse(result)
  return kept.success ? kept.data.assetIds.length : 0
}

export function picturesLeft(count: number, result: unknown): number {
  return Math.max(1, count - keptPictureCount(result))
}
