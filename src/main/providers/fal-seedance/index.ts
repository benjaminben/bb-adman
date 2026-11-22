// This provider's adapters (SPEC 6; phase-07 "fal.ai Seedance", P7-14). The registry row is
// `available: true` since P7-15.
import type { ProviderAdapters } from '@/main/providers/types'
import { falVideo } from './video'

export const adapters: ProviderAdapters = {
  video: (ctx) => falVideo(ctx),
}
