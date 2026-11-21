import { describe, it, expect } from 'vitest'
import {
  ProviderCancelled,
  type CancelOutcome,
  type ImageProvider,
  type RunOptions,
  type RunProgress,
  type VideoProvider,
  type VideoResult,
} from '@/main/providers/types'

const result: VideoResult = { bytes: new Uint8Array([1]), mime: 'video/mp4', model: 'video-x' }

// A hand-built provider in the 1.24 shape: compiling is half of this test.
function videoStub(outcome: CancelOutcome): VideoProvider {
  return {
    start: async (input) => ({ remoteJobId: `r-${input.references.length}` }),
    check: async () => ({ status: 'waiting', queuePosition: 2 }),
    fetchResult: async () => result,
    cancel: async () => outcome,
  }
}

describe('run options and cancel [SPEC 6.11.1, 14 CU-0]', () => {
  it('ProviderCancelled is an Error with its own name', () => {
    const e = new ProviderCancelled('stopped')
    expect(e).toBeInstanceOf(Error)
    expect(e).toBeInstanceOf(ProviderCancelled)
    expect(e.name).toBe('ProviderCancelled')
  })

  it('ImageProvider.generate takes a signal and a progress callback', async () => {
    const seen: RunProgress[] = []
    const image: ImageProvider = {
      generate: async (_input, opts?: RunOptions) => {
        if (opts?.signal?.aborted) throw new ProviderCancelled('never started')
        opts?.onProgress?.({ stage: 'working', fraction: 0.5 })
        return []
      },
      extend: async () => ({ bytes: new Uint8Array(), mime: 'image/png', model: 'm' }),
    }
    const input = { prompt: 'p', references: [], width: 64, height: 64, count: 1 }
    await image.generate(input, { onProgress: (p) => seen.push(p) })
    expect(seen).toEqual([{ stage: 'working', fraction: 0.5 }])
    const signal = AbortSignal.abort()
    await expect(image.generate(input, { signal })).rejects.toBeInstanceOf(ProviderCancelled)
  })

  it('VideoProvider starts with no first frame, gives the bytes itself, and can be cancelled', async () => {
    const video = videoStub('finished')
    const start = { image: null, references: [], prompt: 'p', durationMs: 6000 }
    expect(await video.start({ ...start, width: 64, height: 64 })).toEqual({ remoteJobId: 'r-0' })
    expect(await video.check('r-0')).toEqual({ status: 'waiting', queuePosition: 2 })
    expect(await video.fetchResult('r-0')).toBe(result)
    expect(await video.cancel('r-0')).toBe('finished')
  })
})
