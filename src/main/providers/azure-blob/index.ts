// This provider's adapters (SPEC 6, 6.5). Azure Blob is registered with `available: false`;
// its StorageProvider fails every call with "not available".
import type { ProviderAdapters, StorageProvider } from '../types'

async function notAvailable(): Promise<never> {
  throw new Error('Azure Blob storage is not available')
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
