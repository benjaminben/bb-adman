// The fake provider's cut-out (spec/ai-jobs.md "The fake provider's parts"): a PNG of the
// input's pixel size, solid grey in the middle half and see-through elsewhere.
import { cutoutPng } from './png'
import { fakeRun } from './run'
import { pictureSize } from '@/main/providers/picture-size'
import type { CutoutProvider } from '@/main/providers/types'

export const FAKE_CUTOUT_MODEL = 'fake-cutout'

export function fakeCutout(): CutoutProvider {
  return {
    cutOut: (input, opts) =>
      fakeRun(opts, () => {
        const mime = input.image.mime === 'image/jpeg' ? 'image/jpeg' : 'image/png'
        const { width, height } = pictureSize(input.image.bytes, mime)
        return { bytes: cutoutPng(width, height), mime: 'image/png', model: FAKE_CUTOUT_MODEL }
      }),
  }
}
