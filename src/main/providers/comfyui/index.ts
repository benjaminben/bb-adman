// This provider's adapters (SPEC 6, 6.10). CU-4 adds the picture job; CU-6 adds video.
import type { ProviderAdapters } from '../types'
import { comfyImage } from './image'

export const adapters: ProviderAdapters = {
  image: (ctx) => comfyImage(ctx),
}
