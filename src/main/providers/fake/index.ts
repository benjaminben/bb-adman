// The fake provider's adapters (SPEC 14 slice D; spec/ai-jobs.md "The fake provider's parts"):
// pictures, video, layout, text and cut-out, for tests and CI.
import { fakeCutout } from './cutout'
import { fakeImage } from './image'
import { fakeLayout } from './layout'
import { fakeText } from './text'
import { fakeVideo } from './video'
import type { ProviderAdapters } from '@/main/providers/types'

export const adapters: ProviderAdapters = {
  image: () => fakeImage(),
  layout: () => fakeLayout(),
  text: () => fakeText(),
  video: () => fakeVideo(),
  cutout: () => fakeCutout(),
}
