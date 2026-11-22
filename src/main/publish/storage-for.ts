// The storage a publish writes to (spec/phases/phase-09.md "Publishing", Q-P9-2, A-228). S3 and
// Dropbox come through adapterFor, so their roots, host pins and error rules apply unchanged.
// The fake storage is local storage in {userData}/fake-storage, offered only when the fake
// provider is listed; otherwise it is refused as adapterFor refuses a provider it cannot use.
import path from 'node:path'
import { adapterFor } from '@/main/providers/adapters'
import { localStorageAt } from '@/main/providers/local-storage'
import type { StorageProvider } from '@/main/providers/types'
import type { PublishStorageId } from '@/shared/schemas/commands/publish'
import { AppError } from '@/shared/schemas/result'
import type { StorageForDeps } from './ports'

export const FAKE_STORAGE_FOLDER = 'fake-storage'

export function storageFor(deps: StorageForDeps, storage: PublishStorageId): StorageProvider {
  if (storage !== 'fake') return adapterFor(deps, storage, 'storage')
  if (!deps.providers.some((p) => p.id === 'fake')) {
    throw new AppError('INVALID_INPUT', 'That provider cannot do this yet.', {
      provider: 'fake',
      job: 'storage',
    })
  }
  return localStorageAt(path.join(deps.userDataDir, FAKE_STORAGE_FOLDER))
}
