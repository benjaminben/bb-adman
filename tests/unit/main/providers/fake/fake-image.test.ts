import { describe, it, expect, afterEach } from 'vitest'
import { adapters } from '@/main/providers/fake'
import { resetFakeBehaviour, setFakeBehaviour } from '@/main/providers/fake/behaviour'
import { pngPixelSize } from '@/main/providers/png-size'
import {
  ProviderCancelled,
  ProviderFailure,
  type AdapterContext,
  type RunProgress,
} from '@/main/providers/types'
import { PROVIDER_ERROR_KINDS } from '@/shared/schemas/queries/app'

const ctx = {} as AdapterContext
const input = { prompt: 'a cat', references: [], width: 64, height: 48, count: 2 }
const image = () => {
  const build = adapters.image
  if (!build) throw new Error('fake has no image part')
  return build(ctx)
}

afterEach(() => resetFakeBehaviour())

describe('fake provider, pictures [SPEC 14 slice D]', () => {
  it('makes the asked number of PNGs at the asked size', async () => {
    const results = await image().generate(input)
    expect(results).toHaveLength(2)
    for (const r of results) {
      expect(r.mime).toBe('image/png')
      expect(pngPixelSize(r.bytes)).toEqual({ width: 64, height: 48 })
    }
  })

  it('extends a picture to the asked size', async () => {
    const [png] = await image().generate({ ...input, count: 1 })
    if (!png) throw new Error('no picture')
    const result = await image().extend({
      image: { bytes: png.bytes, mime: 'image/png' },
      placement: { x: 0, y: 0, width: 10, height: 10, rotation: 0, crop: null },
      width: 32,
      height: 20,
      prompt: 'more',
    })
    expect(pngPixelSize(result.bytes)).toEqual({ width: 32, height: 20 })
  })

  it.each(PROVIDER_ERROR_KINDS)('can be told to fail with kind %s', async (kind) => {
    setFakeBehaviour({ fail: kind })
    const error = await image()
      .generate(input)
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ProviderFailure)
    expect((error as ProviderFailure).error.kind).toBe(kind)
  })

  it('reports how far along it is', async () => {
    const seen: RunProgress[] = []
    await image().generate(input, { onProgress: (p) => seen.push(p) })
    expect(seen.map((p) => p.stage)).toEqual(['waiting', 'working'])
    expect(seen[0]?.queuePosition).toBe(1)
  })

  it('waits as long as it is told to', async () => {
    setFakeBehaviour({ waitMs: 60 })
    const start = Date.now()
    await image().generate(input)
    expect(Date.now() - start).toBeGreaterThanOrEqual(50)
  })
})

describe('fake provider, pictures, cancel [SPEC 6.11.2]', () => {
  it('stops when the signal fires: ProviderCancelled', async () => {
    setFakeBehaviour({ waitMs: 5_000, onCancel: 'stop' })
    const controller = new AbortController()
    const run = image().generate(input, { signal: controller.signal })
    controller.abort()
    await expect(run).rejects.toBeInstanceOf(ProviderCancelled)
  })

  it('never starts when the signal has already fired', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(image().generate(input, { signal: controller.signal })).rejects.toBeInstanceOf(
      ProviderCancelled,
    )
  })

  it('can be told to finish anyway', async () => {
    setFakeBehaviour({ waitMs: 5_000, onCancel: 'finish' })
    const controller = new AbortController()
    const run = image().generate(input, { signal: controller.signal })
    controller.abort()
    expect(await run).toHaveLength(2)
  })

  it('can be told not to confirm: the call never settles', async () => {
    setFakeBehaviour({ waitMs: 5_000, onCancel: 'no_confirm' })
    const controller = new AbortController()
    const run = image().generate(input, { signal: controller.signal })
    controller.abort()
    const settled = await Promise.race([
      run.then(
        () => 'settled',
        () => 'settled',
      ),
      new Promise((r) => setTimeout(() => r('pending'), 50)),
    ])
    expect(settled).toBe('pending')
  })
})
