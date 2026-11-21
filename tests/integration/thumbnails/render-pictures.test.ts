// P4-7: RenderService.renderPictures, a variant drawn with its text layers left out, for the
// layout job (spec/ai-jobs.md "Layout proposal", step 2; spec/scene.md "The render service").
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { makeRenderFixture, PNG, V1, V2, type RenderFixture } from './render-fixture'

let r: RenderFixture
afterEach(() => r.f.cleanup())

describe('RenderService.renderPictures [P4-7]', () => {
  it('draws the variant without its text layers, longest side held to the size asked', async () => {
    r = await makeRenderFixture({ draw: async () => ({ png: PNG, overflow: { t1: true } }) })
    r.setRev(V1, 3)
    const reply = await r.service.renderPictures(r.project, V1, 1024)
    expect(reply).toEqual({ png: PNG, width: 819, height: 1024, rev: 3 })
    const [input, size] = r.drawCall(0)
    expect(size).toEqual({ width: 819, height: 1024 })
    expect(input.layers.map((l) => l.id)).toEqual(['p1'])
    expect(Object.keys(input.assets)).toEqual(['img1'])
    expect(input.variant).toMatchObject({ width: 1080, height: 1350 })
  })

  it('reports no overflow and writes no thumbnail', async () => {
    r = await makeRenderFixture({ draw: async () => ({ png: PNG, overflow: { t1: true } }) })
    await r.service.renderPictures(r.project, V1, 1024)
    expect(r.execute).not.toHaveBeenCalled()
    expect(fs.existsSync(path.join(r.f.userData, 'thumbnails'))).toBe(false)
    expect(r.events).toEqual([])
  })

  it('leaves out the font a text layer names', async () => {
    r = await makeRenderFixture()
    await r.service.renderPictures(r.project, V2, 1024)
    const [input] = r.drawCall(0)
    expect(input.layers).toEqual([])
    expect(input.assets).toEqual({})
  })

  it('answers render_failed when the draw fails', async () => {
    r = await makeRenderFixture({
      draw: async () => {
        throw new Error('x')
      },
    })
    await expect(r.service.renderPictures(r.project, V1, 1024)).rejects.toMatchObject({
      code: 'RULE_VIOLATION',
      details: { reason: 'render_failed' },
    })
  })

  it('refuses an unknown variant with NOT_FOUND', async () => {
    r = await makeRenderFixture()
    await expect(r.service.renderPictures(r.project, 'nope', 1024)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})
