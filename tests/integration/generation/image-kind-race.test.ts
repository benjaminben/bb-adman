import fs from 'node:fs'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { makeKindFixture, type KindFixture } from './kind-fixture'
import { waitFor } from './generation-fixture'

let f: KindFixture
afterEach(() => {
  vi.restoreAllMocks()
  f.cleanup()
})

const done = (id: string) => () =>
  ['succeeded', 'failed', 'cancelled'].includes(f.job(id)?.status ?? '')

// The first pictures of a project: two writers both find no assets folder and one makes it
// first. The stat stand-in plays the other writer, so the order is the same every run.
describe('a paid picture is kept when another picture made the assets folder [SPEC 6.2; cost]', () => {
  it('ends succeeded with the picture stored', async () => {
    f = makeKindFixture()
    const dir = f.assetsDir()
    const real = fs.promises.stat.bind(fs.promises)
    vi.spyOn(fs.promises, 'stat').mockImplementation(async (p, opts) => {
      if (p !== dir || fs.existsSync(dir)) return real(p, opts)
      fs.mkdirSync(dir, { recursive: true })
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    })
    const id = await f.start({ count: 1 })
    await waitFor(done(id))
    expect(f.job(id)).toMatchObject({ status: 'succeeded', paidCalls: 1 })
    expect((f.job(id)?.result as { assetIds: string[] }).assetIds).toHaveLength(1)
    expect(f.assets()).toHaveLength(1)
  })
})
