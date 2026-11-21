// SPEC 4.1, 6: how dev.storage reports a storage failure. A ProviderFailure becomes
// PROVIDER_ERROR with the plain message for its kind and `details` { provider, kind }; the raw
// detail stays in the main process. [1.21] M2: a refused storage path comes back only after
// the file name passed the name check, so a link on disk is in the way: RULE_VIOLATION,
// storage_folder_unsafe. Anything else is passed on for the bus.
// The messages are the Section 6 table, used here only until slice D's
// src/main/providers/messages.ts exists; this file goes with the hand-test tools.
import { AppError } from '../../../shared/schemas/result'
import type { ProviderErrorKind } from '../../../shared/schemas/queries/app'
import { REFUSED_PATH } from '../../providers/storage-paths'
import { ProviderFailure } from '../../providers/types'
import { folderUnsafe } from './local-root'

const MESSAGES: Record<ProviderErrorKind, (p: string) => string> = {
  bad_key: (p) => `${p} did not accept your key. Check it in Settings and try again.`,
  quota: (p) =>
    `Your ${p} account has reached its limit. Check your plan with ${p}, then try again.`,
  refused: (p) =>
    `${p} declined this request because of its content rules. Change the prompt or the images and try again.`,
  timeout: (p) => `${p} took too long to answer. Try again.`,
  offline: (p) => `The app could not reach ${p}. Check your internet connection and try again.`,
  other: (p) => `${p} could not finish this request. Try again.`,
}

export type StorageLabel = { id: string; label: string }

export function storageError(error: unknown, provider: StorageLabel): unknown {
  if (error instanceof ProviderFailure) {
    const { kind } = error.error
    return new AppError('PROVIDER_ERROR', MESSAGES[kind](provider.label), {
      provider: provider.id,
      kind,
    })
  }
  if (error instanceof Error && error.constructor === Error && error.message === REFUSED_PATH) {
    return folderUnsafe()
  }
  return error
}
