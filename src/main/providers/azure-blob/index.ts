// This provider's adapters (SPEC 6, 6.5). Azure Blob is registered with `available: false`;
// its StorageProvider rejects every call with a ProviderFailure of kind other, "not available"
// (SPEC 6.5 [1.14]).
import { ProviderFailure, type ProviderAdapters, type StorageProvider } from '../types'

async function notAvailable(): Promise<never> {
  throw new ProviderFailure({ kind: 'other', detail: 'Azure Blob storage is not available' })
}

const azureBlobStorage: StorageProvider = {
  exists: notAvailable,
  read: notAvailable,
  write: notAvailable,
  list: notAvailable,
  remove: notAvailable,
}

export const adapters: ProviderAdapters = {
  storage: () => azureBlobStorage,
}
