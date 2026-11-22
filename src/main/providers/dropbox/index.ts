// This provider's adapters (SPEC 6, spec/storage-and-publish.md "Dropbox"). The storage runs
// over the pinned Dropbox fetch.
import type { ProviderAdapters } from '@/main/providers/types'
import { dropboxStorage } from './dropbox-storage'
import { defaultDropboxFetch } from './fetch'

export const adapters: ProviderAdapters = {
  storage: (ctx) => dropboxStorage(ctx, { fetch: defaultDropboxFetch }),
}
