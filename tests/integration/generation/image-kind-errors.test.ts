import fs from 'node:fs'
import { describe, it, expect, afterEach } from 'vitest'
import { makeKindFixture, pngAnswer, type KindFixture } from './kind-fixture'
import { waitFor } from './generation-fixture'

let f: KindFixture
afterEach(() => f.cleanup())

const done = (id: string) => () =>
  ['succeeded', 'failed', 'cancelled'].includes(f.job(id)?.status ?? '')

describe('an unforeseen error in an image job sends no further call [SPEC 6.11.1; cost]', () => {
  it('a provider error that is not a ProviderFailure ends the job failed as other after the calls already sent', async () => {
    f = makeKindFixture()
    f.t.answers = [
      async () => {
        throw new Error('Something broke')
      },
      pngAnswer(),
    ]
    const id = await f.start({ count: 6 })
    await waitFor(done(id))
    expect(f.job(id)).toMatchObject({ status: 'failed', errorKind: 'other' })
    expect(f.calls.length).toBeLessThanOrEqual(2)
    expect(f.job(id)?.paidCalls).toBe(f.calls.length)
  })

  it('a picture that cannot be written ends the job failed as other and sends no further call', async () => {
    f = makeKindFixture()
    // Something that is not a folder stands where the assets folder goes.
    fs.writeFileSync(f.assetsDir(), 'not a folder')
    const id = await f.start({ count: 6 })
    await waitFor(done(id))
    expect(f.job(id)).toMatchObject({ status: 'failed', errorKind: 'other' })
    expect(f.calls.length).toBeLessThanOrEqual(2)
    expect(f.assets()).toEqual([])
  })
})
