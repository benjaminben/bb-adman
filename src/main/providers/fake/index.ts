// The fake provider's adapters (SPEC 14 slice D): pictures and video, for tests and CI.
import { fakeImage } from './image'
import { fakeVideo } from './video'
import type { ProviderAdapters } from '../types'

export const adapters: ProviderAdapters = {
  image: () => fakeImage(),
  video: () => fakeVideo(),
}
