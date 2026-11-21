// One fake call (spec/ai-jobs.md "The fake provider's parts"): honours setFakeBehaviour's
// fail, waitMs and onCancel and opts.signal, the way the picture part does (SPEC 6.11.2).
import { FAKE_FAILURE_DETAIL, fakeBehaviour } from './behaviour'
import { ProviderCancelled, ProviderFailure, type RunOptions } from '@/main/providers/types'

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

export async function fakeRun<T>(opts: RunOptions | undefined, make: () => T): Promise<T> {
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
