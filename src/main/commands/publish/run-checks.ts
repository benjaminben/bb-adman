// The checks publish.run makes before it queues a publish (spec/phases/phase-09.md "Publishing").
// The storage is checked as readiness.ts checks it, but thrown: fake only when listed; S3
// settings, then keys; Dropbox signed in, and its saved folder checked again, since
// settings.json can be edited by hand (a bad one refuses, never falls back to the root). A
// storage failure while counting the published files is one fixed sentence and the kind's own,
// its detail kept out of the reply and the log.
import type { CoreDeps } from '@/main/core-deps'
import { requireS3Settings } from '@/main/commands/storage/require-s3-settings'
import { LocalFailure } from '@/main/jobs/local-failure'
import { isDropboxRootPath } from '@/main/providers/dropbox/root-path'
import { plainMessage } from '@/main/providers/messages'
import { requireProviderKeys } from '@/main/providers/require-keys'
import { ProviderFailure } from '@/main/providers/types'
import { campaignPrefix } from '@/main/publish/manifest'
import type { PublishWarning } from '@/main/publish/ports'
import { PUBLISHED_FOLDER_UNREADABLE, publishRefusal } from '@/shared/publish/messages'
import type { PublishRunInput, PublishStorageId } from '@/shared/schemas/commands/publish'
import { AppError } from '@/shared/schemas/result'

export function requireStorageReady(deps: CoreDeps, storage: PublishStorageId): void {
  if (storage === 'fake') {
    if (deps.providers.some((p) => p.id === 'fake')) return
    throw new AppError('INVALID_INPUT', 'That provider cannot do this yet.', {
      provider: 'fake',
      job: 'storage',
    })
  }
  if (storage === 's3') requireS3Settings(deps)
  requireProviderKeys(deps, storage, 'publish')
  if (storage === 'dropbox') {
    const rootPath = deps.settings.get().storage.dropbox?.rootPath ?? ''
    if (!isDropboxRootPath(rootPath)) throw publishRefusal('dropbox_folder_refused')
  }
}

function folderUnreadable(deps: CoreDeps, storage: PublishStorageId, error: unknown): AppError {
  const kind = error instanceof ProviderFailure ? error.error.kind : 'other'
  const label = deps.providers.find((p) => p.id === storage)?.label ?? storage
  // The kind only: a provider's detail may name a key or an address.
  deps.log.write({
    level: 'warn',
    event: 'command',
    name: 'publish.run',
    actor: 'user',
    ok: false,
    errorKind: kind,
    message: 'The published folder could not be read.',
    context: { provider: storage },
  })
  const message = `${PUBLISHED_FOLDER_UNREADABLE} ${plainMessage(kind, label)}`
  return new AppError('PROVIDER_ERROR', message, { provider: storage, kind })
}

// The number of files under {campaignId}/ in the storage now.
export async function publishedFileCount(
  deps: CoreDeps,
  storage: PublishStorageId,
  campaignId: string,
): Promise<number> {
  try {
    const prefix = campaignPrefix(campaignId)
    const listed = await deps.publish.storageFor(deps, storage).list(prefix)
    return listed.filter((p) => p.startsWith(prefix)).length
  } catch (error) {
    throw folderUnreadable(deps, storage, error)
  }
}

// The checks' warnings. Until export is built (P9-11) the port refuses with export_not_built;
// that counts as none here, and the job then fails with export_not_built before it uploads.
export async function warningsOf(
  deps: CoreDeps,
  input: PublishRunInput,
): Promise<PublishWarning[]> {
  try {
    return await deps.publish.warningsForPublish(deps, {
      projectId: input.projectId,
      campaignId: input.campaignId,
    })
  } catch (error) {
    if (error instanceof LocalFailure && error.reason === 'export_not_built') return []
    throw error
  }
}
