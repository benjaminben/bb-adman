// The fake provider's pictures (SPEC 14 slice D). Honours opts.signal as SPEC 6.11.2 asks,
// in the way fakeBehaviour().onCancel says, through the shared fakeRun.
import { greyPng } from './png'
import { fakeRun } from './run'
import type { ImageProvider, ImageResult } from '@/main/providers/types'

export const FAKE_IMAGE_MODEL = 'fake-image'

function picture(width: number, height: number): ImageResult {
  return { bytes: greyPng(width, height), mime: 'image/png', model: FAKE_IMAGE_MODEL }
}

export function fakeImage(): ImageProvider {
  return {
    generate: (input, opts) =>
      fakeRun(opts, () =>
        Array.from({ length: input.count }, () => picture(input.width, input.height)),
      ),
    extend: (input, opts) => fakeRun(opts, () => picture(input.width, input.height)),
  }
}
