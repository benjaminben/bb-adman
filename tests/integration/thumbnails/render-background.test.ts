// P7-16 (A-176): RenderService.renderBackground, the first frame of a `background` video start.
// The background layer and the clip track only, at time 0, the variant's shape kept with the
// longer side of the run size; no overflow report, no event, no file kept.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { makeRenderFixture, PNG, V1, type RenderFixture } from './render-fixture'

let r: RenderFixture
afterEach(() => r.f.cleanup())

// V1's picture layer made its background layer, beside its text layer t1.
const withBackground = () =>
  r.project.db.prepare(`UPDATE layer SET type = 'background' WHERE id = 'p1'`).run()

describe('RenderService.renderBackground [P7-16]', () => {
  it('draws the background layer alone at time 0, longer side of the run size', async () => {
    r = await makeRenderFixture({ draw: async () => ({ png: PNG, overflow: { t1: true } }) })
    withBackground()
    const png = await r.service.renderBackground(r.project, V1, { width: 720, height: 896 })
    expect(png).toEqual(PNG)
    const [input, size] = r.drawCall(0)
    expect(size).toEqual({ width: 717, height: 896 })
    expect(input.layers.map((l) => l.id)).toEqual(['p1'])
    expect(input.timeMs).toBe(0)
    expect(r.execute).not.toHaveBeenCalled()
    expect(r.events).toEqual([])
    expect(fs.existsSync(path.join(r.f.userData, 'thumbnails'))).toBe(false)
  })

  it('a video variant carries its clip track', async () => {
    r = await makeRenderFixture()
    withBackground()
    r.project.db.prepare(`UPDATE variant SET format = 'video', duration_ms = 4000`).run()
    await r.service.renderBackground(r.project, V1, { width: 720, height: 896 })
    const [input] = r.drawCall(0)
    expect(input.clips).toEqual([])
    expect(input.layers.map((l) => l.type)).toEqual(['background'])
  })

  it('answers render_failed when the draw fails, NOT_FOUND for an unknown variant', async () => {
    r = await makeRenderFixture({ draw: () => Promise.reject(new Error('x')) })
    const size = { width: 720, height: 896 }
    await expect(r.service.renderBackground(r.project, V1, size)).rejects.toMatchObject({
      details: { reason: 'render_failed' },
    })
    await expect(r.service.renderBackground(r.project, 'nope', size)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})
