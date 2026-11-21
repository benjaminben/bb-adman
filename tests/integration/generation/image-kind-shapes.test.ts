import { describe, it, expect, afterEach } from 'vitest'
import { makeKindFixture, pngAnswer, type KindFixture } from './kind-fixture'
import { waitFor } from './generation-fixture'
import { imageJobResult } from '@/shared/schemas/jobs/image-generation'

let f: KindFixture
afterEach(() => f.cleanup())

const done = (id: string) => () =>
  ['succeeded', 'failed', 'cancelled'].includes(f.job(id)?.status ?? '')

describe('the image job result has the shared shape [SPEC 14 1.42 H-R1, H4-1]', () => {
  it('the result a finished job stores passes imageJobResult', async () => {
    f = makeKindFixture()
    f.t.answers = [pngAnswer(), 'quota']
    const id = await f.start({ count: 2 })
    await waitFor(done(id))
    const row = f.job(id)
    expect(row?.status).toBe('succeeded')
    expect(imageJobResult.parse(row?.result)).toEqual(row?.result)
    expect(row?.result).toMatchObject({ failures: { quota: 1 } })
  })

  it('the result kept after the first of two pictures passes imageJobResult', async () => {
    f = makeKindFixture()
    const id = await f.start({ count: 2 })
    await waitFor(done(id))
    const kept = f
      .jobEvents(id)
      .filter((r) => r.status === 'running')
      .map((r) => r.result)
      .find((r) => (r as { assetIds?: string[] } | null)?.assetIds?.length === 1)
    expect(kept).toBeDefined()
    expect(imageJobResult.safeParse(kept).success).toBe(true)
  })
})
