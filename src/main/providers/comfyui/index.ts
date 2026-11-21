// This provider's adapters (SPEC 6, 6.10). CU-4 adds the picture job; CU-6a adds video;
// P4-9 adds the cut-out.
import type { ProviderAdapters } from '@/main/providers/types'
import { comfyCutout } from './cutout'
import { comfyImage } from './image'
import { comfyVideo } from './video'

export const adapters: ProviderAdapters = {
  image: (ctx) => comfyImage(ctx),
  video: (ctx) => comfyVideo(ctx),
  cutout: (ctx) => comfyCutout(ctx),
}
