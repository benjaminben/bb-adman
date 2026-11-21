// spec/scene.md, "The render service" (after a draw); spec/editor-commands.md,
// "layer.reportOverflow" [FR-098]. The command is a later slice, so the bus is a stand-in.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { makeRenderFixture, PNG, V1, V2, type RenderFixture } from './render-fixture'

let r: RenderFixture
afterEach(() => r.f.cleanup())

describe('overflow after each draw [spec/scene.md, The render service; FR-098]', () => {
  it('sends layer.reportOverflow once for a text layer whose measured overflow changed', async () => {
    r = await makeRenderFixture({
      // t1 is stored false and measured true; p1 is not text; zz is not in the variant.
      draw: async () => ({ png: PNG, overflow: { t1: true, p1: true, zz: true } }),
    })
    r.setRev(V1, 6)
    await r.query('thumbnail.get', { variantId: V1 })
    await vi.waitFor(() => expect(r.changed(V1)).toHaveLength(1))
    expect(r.execute).toHaveBeenCalledTimes(1)
    expect(r.execute).toHaveBeenCalledWith(
      'layer.reportOverflow',
      { projectId: r.projectId, layerId: 't1', overflow: true, variantRev: 6 },
      { actor: 'user' },
    )
  })

  it.each([
    ['the measured value equals the stored one', { t2: true }],
    ['the draw measured nothing for the layer', {}],
  ])('sends nothing when %s', async (_case, overflow) => {
    r = await makeRenderFixture({ draw: async () => ({ png: PNG, overflow }) })
    await r.query('thumbnail.get', { variantId: V2 })
    await vi.waitFor(() => expect(r.changed(V2)).toHaveLength(1))
    expect(r.execute).not.toHaveBeenCalled()
  })

  it('reports overflow after a variant.render draw too', async () => {
    r = await makeRenderFixture({ draw: async () => ({ png: PNG, overflow: { t2: false } }) })
    await r.query('variant.render', { variantId: V2 })
    expect(r.execute).toHaveBeenCalledTimes(1)
    expect(r.execute.mock.calls[0]?.[1]).toEqual({
      projectId: r.projectId,
      layerId: 't2',
      overflow: false,
      variantRev: 0,
    })
  })
})
