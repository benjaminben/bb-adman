// spec/scene.md, "The render service": eager thumbnails after a quiet second, and a redraw when
// a file a variant uses changed on disk.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { makeRenderFixture, PNG, V1, V2, type RenderFixture } from './render-fixture'
import type { BusEvent } from '@/main/commands/bus'

let r: RenderFixture
afterEach(() => {
  vi.useRealTimers()
  r.f.cleanup()
})

function variantChanged(variantIds: string[], removed: string[] = []): BusEvent {
  return {
    name: 'project.changed',
    payload: {
      projectId: r.projectId,
      changed: { variant: variantIds.map((id) => ({ id })) },
      removed: { variant: removed },
      actor: 'agent',
    },
  }
}

const drawnVariants = () =>
  r.draw.mock.calls.map(([input]) => (input.variant.height === 1350 ? V1 : V2))

describe('eager thumbnails [spec/scene.md, The render service]', () => {
  it('draws each variant once after a burst of changes, when it has been quiet for 1 second', async () => {
    r = await makeRenderFixture()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    for (let i = 0; i < 5; i++) {
      r.setRev(V1, i)
      r.service.onEvent(variantChanged([V1, V2]))
      await vi.advanceTimersByTimeAsync(500)
    }
    expect(r.draw).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1000)
    vi.useRealTimers()
    await vi.waitFor(() => expect(r.changed(V2)).toHaveLength(1))
    await vi.waitFor(() => expect(r.changed(V1)).toHaveLength(1))
    expect(drawnVariants().sort()).toEqual([V1, V2])
    expect(fs.readdirSync(r.dir).sort()).toEqual([`${V1}-4.png`, `${V2}-0.png`])
  })

  it('a removed variant is not drawn', async () => {
    r = await makeRenderFixture()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    r.service.onEvent(variantChanged([V1, V2]))
    r.service.onEvent(variantChanged([], [V2]))
    await vi.advanceTimersByTimeAsync(1000)
    vi.useRealTimers()
    await vi.waitFor(() => expect(r.changed(V1)).toHaveLength(1))
    expect(drawnVariants()).toEqual([V1])
  })

  it('ignores events of a project that is not open', async () => {
    r = await makeRenderFixture()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    r.service.onEvent({
      name: 'project.changed',
      payload: {
        projectId: '01HZY3V7Q8R9S0T1V2W3X4Y5Z6',
        changed: { variant: [{ id: V1 }] },
        removed: {},
        actor: 'user',
      },
    })
    await vi.advanceTimersByTimeAsync(2000)
    expect(r.draw).not.toHaveBeenCalled()
  })
})

describe('changed files [spec/scene.md, The render service; spec/data-rules.md, Caching]', () => {
  it('redraws only the variants whose layers use the changed asset', async () => {
    r = await makeRenderFixture()
    for (const v of [V1, V2]) await r.query('thumbnail.get', { variantId: v })
    await vi.waitFor(() => expect(r.events).toHaveLength(2))
    r.draw.mockClear()
    fs.writeFileSync(path.join(r.dir, `${V2}-0.png`), 'old picture')
    r.service.onEvent({
      name: 'asset.changedOnDisk',
      payload: { projectId: r.projectId, assetIds: ['font1'] },
    })
    await vi.waitFor(() => expect(r.changed(V2)).toHaveLength(3))
    await vi.waitFor(() => expect(r.draw).toHaveBeenCalledTimes(1))
    expect(drawnVariants()).toEqual([V2])
    await vi.waitFor(() =>
      expect(new Uint8Array(fs.readFileSync(path.join(r.dir, `${V2}-0.png`)))).toEqual(PNG),
    )
    expect(r.changed(V1)).toHaveLength(1)
  })

  it('clears a failed mark when a file the variant uses changed', async () => {
    let fail = true
    r = await makeRenderFixture({
      draw: async () => {
        if (fail) throw new Error('x')
        return { png: PNG, overflow: {} }
      },
    })
    await r.query('thumbnail.get', { variantId: V1 })
    await vi.waitFor(() => expect(r.changed(V1)).toHaveLength(1))
    expect(await r.query('thumbnail.get', { variantId: V1 })).toMatchObject({ state: 'failed' })
    fail = false
    r.service.onEvent({
      name: 'asset.changedOnDisk',
      payload: { projectId: r.projectId, assetIds: ['img1'] },
    })
    await vi.waitFor(() => expect(r.changed(V1)).toHaveLength(3))
    expect(await r.query('thumbnail.get', { variantId: V1 })).toMatchObject({ state: 'ready' })
  })
})
