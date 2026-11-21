// This provider's adapters (P4-6, spec/providers-adapters.md "Adobe Firefly (stub)"). A stub by
// design: the registry row has `available: false`, so adapterFor never hands this out.
import type { ProviderAdapters } from '@/main/providers/types'
import { fireflyImage } from './image'

export const adapters: ProviderAdapters = {
  image: (ctx) => fireflyImage(ctx),
}
