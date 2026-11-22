// Whether each publish storage can be used now (spec/phases/phase-09.md "Publishing",
// publish.inspect). The same checks publish.run makes, turned into a value instead of thrown at
// the window: requireS3Settings, then the one key guard (NEEDS_KEY for S3, the sign-in check
// dropbox_not_signed_in for Dropbox). `fake` is listed only when the fake provider is.
import type { CoreDeps } from '@/main/core-deps'
import { requireS3Settings } from '@/main/commands/storage/require-s3-settings'
import { requireProviderKeys } from '@/main/providers/require-keys'
import type { PublishStorageId } from '@/shared/schemas/commands/publish'
import type { PublishInspect, PublishReady } from '@/shared/schemas/queries/publish'
import { AppError } from '@/shared/schemas/result'

type Deps = Pick<CoreDeps, 'providers' | 'secrets' | 'settings'>

const reasonOf = (error: unknown) =>
  error instanceof AppError ? (error.details as { reason?: unknown } | undefined)?.reason : null

// The value for a refusal of the checks; anything else is not a readiness answer.
function readyFrom(error: unknown): PublishReady {
  if (reasonOf(error) === 'storage_not_set_up') return 'not_set_up'
  if (reasonOf(error) === 'dropbox_not_signed_in') return 'not_signed_in'
  if (error instanceof AppError && error.code === 'NEEDS_KEY') return 'needs_key'
  throw error
}

export function storageReadiness(deps: Deps, storage: PublishStorageId): PublishReady {
  if (storage === 'fake') return 'ready'
  try {
    if (storage === 's3') requireS3Settings(deps)
    requireProviderKeys(deps, storage, 'publish')
    return 'ready'
  } catch (error) {
    return readyFrom(error)
  }
}

// The storages the dialog offers, in this order, each with its registry label.
export function publishStorages(deps: Deps): PublishInspect['storages'] {
  const ids: PublishStorageId[] = ['s3', 'dropbox']
  if (deps.providers.some((p) => p.id === 'fake')) ids.push('fake')
  return ids.map((id) => ({
    id,
    label: deps.providers.find((p) => p.id === id)?.label ?? id,
    ready: storageReadiness(deps, id),
  }))
}
