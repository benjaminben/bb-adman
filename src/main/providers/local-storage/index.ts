// SPEC 6.5 [1.13]: local storage is reached directly with `localStorageAt(root)`, not through
// `adapterFor`: its root differs for each use and is not a setting. Only main-process code
// sets a root. `adapters` stays empty.
import type { ProviderAdapters } from '@/main/providers/types'

export { localStorageAt } from './local-storage'

export const adapters: ProviderAdapters = {}
