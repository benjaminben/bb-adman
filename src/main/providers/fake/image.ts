// The fake provider's pictures (SPEC 14 slice D). Honours opts.signal as SPEC 6.11.2 asks,
// in the way fakeBehaviour().onCancel says.
import { FAKE_FAILURE_DETAIL, fakeBehaviour } from './behaviour'
import { greyPng } from './png'
import {
  ProviderCancelled,
  ProviderFailure,
  type ImageProvider,
  type ImageResult,
  type RunOptions,
} from '@/main/providers/types'

export const FAKE_IMAGE_MODEL = 'fake-image'

const never = () => new Promise<never>(() => undefined)

// Resolves after ms, or as soon as the signal fires. True when it fired.
function wait(ms: number, signal?: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve(true)
    const timer = setTimeout(() => resolve(false), ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      resolve(true)
    })
  })
}

async function run<T>(opts: RunOptions | undefined, make: () => T): Promise<T> {
  const b = fakeBehaviour()
  if (opts?.signal?.aborted) throw new ProviderCancelled()
  opts?.onProgress?.({ stage: 'waiting', queuePosition: 1 })
  opts?.onProgress?.({ stage: 'working', fraction: 0.5 })
  const fired = await wait(b.waitMs, opts?.signal)
  if (fired && b.onCancel === 'stop') throw new ProviderCancelled()
  if (fired && b.onCancel === 'no_confirm') return never()
  if (b.fail) throw new ProviderFailure({ kind: b.fail, detail: FAKE_FAILURE_DETAIL })
  return make()
}

function picture(width: number, height: number): ImageResult {
  return { bytes: greyPng(width, height), mime: 'image/png', model: FAKE_IMAGE_MODEL }
}

export function fakeImage(): ImageProvider {
  return {
    generate: (input, opts) =>
      run(opts, () =>
        Array.from({ length: input.count }, () => picture(input.width, input.height)),
      ),
    extend: (input, opts) => run(opts, () => picture(input.width, input.height)),
  }
}
