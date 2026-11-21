// This provider's adapters (SPEC 6, 6.2). Phase 2 slice E builds the image job only;
// layout and text arrive in Phase 4.
import type { ProviderAdapters } from '@/main/providers/types'
import { geminiImage } from './image'

export const adapters: ProviderAdapters = {
  image: (ctx) => geminiImage(ctx),
}
