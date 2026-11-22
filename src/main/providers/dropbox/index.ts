// This provider's adapters (SPEC 6, spec/storage-and-publish.md "Dropbox"). The storage runs
// over the core's Dropbox fetch, handed in through the adapter context (P9-3b); a context
// without one is refused, never sent over a default fetch.
import type { ProviderAdapters } from '@/main/providers/types'
import { dropboxStorage } from './dropbox-storage'

export const adapters: ProviderAdapters = {
  storage: (ctx) => {
    if (!ctx.dropboxFetch) throw new Error('No Dropbox fetch was handed in')
    return dropboxStorage(ctx, { fetch: ctx.dropboxFetch })
  },
}
