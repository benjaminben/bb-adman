// spec/editor-commands.md, "variant.render"; spec/api-principles.md, render_failed.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { makeRenderFixture, PNG, V1, V2, type RenderFixture } from './render-fixture'
import { THUMBNAIL_DENIED } from '@/main/queries/render'

let r: RenderFixture
afterEach(() => r.f.cleanup())

describe('variant.render [spec/editor-commands.md, variant.render]', () => {
  it.each([
    ['the default 1024', V1, undefined, { width: 819, height: 1024 }],
    ['64', V1, 64, { width: 51, height: 64 }],
    ['2048, held to the variant size', V1, 2048, { width: 1080, height: 1350 }],
    ['1080 on a square variant', V2, 1080, { width: 1080, height: 1080 }],
  ])('draws with maxDimension %s', async (_case, variantId, maxDimension, size) => {
    r = await makeRenderFixture()
    r.setRev(variantId, 2)
    const reply = await r.query('variant.render', { variantId, maxDimension })
    expect(reply).toEqual({ png: PNG, ...size, rev: 2 })
    expect(r.drawCall(0)[1]).toEqual(size)
    expect(fs.existsSync(path.join(r.f.userData, 'thumbnails'))).toBe(false)
    expect(r.events).toEqual([])
  })

  it.each([63, 2049, 100.5, '512'])('refuses maxDimension %s as INVALID_INPUT', async (max) => {
    r = await makeRenderFixture()
    await expect(
      r.query('variant.render', { variantId: V1, maxDimension: max }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    expect(r.draw).not.toHaveBeenCalled()
  })

  it('answers render_failed when the draw fails, and writes no file', async () => {
    r = await makeRenderFixture({
      draw: async () => {
        throw Object.assign(new Error('x'), { reason: 'timeout' })
      },
    })
    await expect(r.query('variant.render', { variantId: V1 })).rejects.toMatchObject({
      code: 'RULE_VIOLATION',
      message: 'The picture could not be drawn. Try again.',
      details: { reason: 'render_failed' },
    })
    expect(r.f.readLogs()).toContain('"reason":"timeout"')
    expect(fs.existsSync(path.join(r.f.userData, 'thumbnails'))).toBe(false)
  })

  it('refuses an unknown variant with NOT_FOUND', async () => {
    r = await makeRenderFixture()
    await expect(r.query('variant.render', { variantId: 'zzzzzz' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('is open to the user only, like thumbnail.get', async () => {
    r = await makeRenderFixture()
    const input = { variantId: V1 }
    await expect(r.query('variant.render', input, 'user')).resolves.toMatchObject({ rev: 0 })
    await expect(r.query('thumbnail.get', input, 'agent')).rejects.toMatchObject({
      code: 'AGENT_DENIED',
    })
  })

  it('draws for an agent too (P10-3, A-234), while thumbnail.get still refuses one', async () => {
    r = await makeRenderFixture()
    const input = { variantId: V1 }
    await expect(r.query('variant.render', input, 'agent')).resolves.toMatchObject({ png: PNG })
    await expect(r.query('thumbnail.get', input, 'agent')).rejects.toMatchObject({
      code: 'AGENT_DENIED',
      message: THUMBNAIL_DENIED,
    })
    expect(r.execute).not.toHaveBeenCalled()
  })
})
