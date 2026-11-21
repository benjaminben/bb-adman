// SPEC 4.1, 6: how dev.storage reports a storage failure. A ProviderFailure becomes
// PROVIDER_ERROR with the plain message for its kind and `details` { provider, kind }; the raw
// detail stays in the main process. [1.21] M2: a refused storage path comes back only after
// the file name passed the name check, so a link on disk is in the way: RULE_VIOLATION,
// storage_folder_unsafe. Anything else is passed on for the bus.
// The messages come from src/main/providers/messages.ts (SPEC 14, F-06).
import { AppError } from '../../../shared/schemas/result'
import { plainMessage } from '../../providers/messages'
import { REFUSED_PATH } from '../../providers/storage-paths'
import { ProviderFailure } from '../../providers/types'
import { folderUnsafe } from './local-root'

export type StorageLabel = { id: string; label: string }

export function storageError(error: unknown, provider: StorageLabel): unknown {
  if (error instanceof ProviderFailure) {
    const { kind } = error.error
    return new AppError('PROVIDER_ERROR', plainMessage(kind, provider.label), {
      provider: provider.id,
      kind,
    })
  }
  if (error instanceof Error && error.constructor === Error && error.message === REFUSED_PATH) {
    return folderUnsafe()
  }
  return error
}
