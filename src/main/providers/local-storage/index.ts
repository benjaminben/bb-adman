// This provider's adapters (SPEC 6). Its slice fills this object.
// `localStorageAt(root)` is the local StorageProvider (SPEC 6.5, slice F). It is not on
// `adapters.storage` yet: AdapterContext gives no root folder for it (see HANDOFF.md).
import type { ProviderAdapters } from '../types'

export { localStorageAt } from './local-storage'

export const adapters: ProviderAdapters = {}
