// P7-7: variant.render takes a time (timeMs, a whole number, at least 0, default 0) and the
// draw gets it. A thumbnail is still drawn at 0.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { makeRenderFixture, V1, type RenderFixture } from './render-fixture'

let r: RenderFixture
afterEach(() => r.f.cleanup())

describe('variant.render at a time [P7-7]', () => {
  it.each([
    ['no time given', {}, 0],
    ['0', { timeMs: 0 }, 0],
    ['2500', { timeMs: 2500 }, 2500],
  ])('draws with %s', async (_case, time, want) => {
    r = await makeRenderFixture()
    await r.query('variant.render', { variantId: V1, maxDimension: 64, ...time })
    expect(r.drawCall(0)[0].timeMs).toBe(want)
  })

  it.each([-1, 1.5, '100', null])('refuses timeMs %s as INVALID_INPUT', async (timeMs) => {
    r = await makeRenderFixture()
    await expect(r.query('variant.render', { variantId: V1, timeMs })).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    })
    expect(r.draw).not.toHaveBeenCalled()
  })

  it('draws a thumbnail at 0', async () => {
    r = await makeRenderFixture()
    await r.query('thumbnail.get', { variantId: V1 })
    await vi.waitFor(() => expect(r.draw).toHaveBeenCalledTimes(1))
    expect(r.drawCall(0)[0].timeMs).toBe(0)
  })
})
