// This provider's adapters (SPEC 6, 6.5). Phase 2 slice F builds the storage job.
import type { ProviderAdapters } from '@/main/providers/types'
import { s3Storage } from './s3-storage'

export const adapters: ProviderAdapters = {
  storage: (ctx) => s3Storage(ctx),
}
