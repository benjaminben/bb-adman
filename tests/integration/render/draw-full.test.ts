// P8-4: RenderService.drawFull over a fake draw (spec/phases/phase-08.md "Drawing at full
// size"; spec/scene.md "The render service"). A real core gives the folders and the log; the
// draw, the bus and the picture encoder are stand-ins.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { makeFixture, type Fixture } from '../core-fixture'
import { createRenderService } from '@/main/thumbnails/service'
import type { CommandBus } from '@/main/commands/bus'
import type { DrawScene } from '@/main/thumbnails/types'
import type { ExportPictures } from '@/main/export/types'
import type { SceneInput } from '@/shared/scene/types'

let f: Fixture | undefined
afterEach(() => {
  f?.cleanup()
  f = undefined
})

const TILE_PNG = new Uint8Array([137, 80, 78, 71, 1])
const JOINED_PNG = new Uint8Array([137, 80, 78, 71, 2])

function scene(width: number, height: number): SceneInput {
  return {
    projectId: '01HZY3V7Q8R9S0T1V2W3X4Y5Z6',
    variant: { width, height, language: 'en', format: 'image', durationMs: 0 },
    layers: [],
    assets: {},
    timeMs: 0,
    mode: 'full',
  }
}

function build(draw?: DrawScene) {
  const fx = makeFixture()
  f = fx
  const drawScene = vi.fn<DrawScene>(
    draw ?? (async () => ({ png: TILE_PNG, overflow: { t1: true } })),
  )
  const stitch = vi.fn<ExportPictures['stitch']>(() => JOINED_PNG)
  const pictures = { toJpeg: vi.fn(), stitch, shrink: vi.fn() } as unknown as ExportPictures
  const execute = vi.fn<CommandBus['execute']>()
  const emit = vi.fn()
  const service = createRenderService({
    deps: () => ({ ...fx.core.deps, exportPictures: pictures }),
    bus: () => ({ execute }),
    emit,
    draw: drawScene,
  })
  return { fx, service, drawScene, stitch, execute, emit }
}

describe('RenderService.drawFull [P8-4, A-190, A-191]', () => {
  it('draws a 4,000 x 1,000 variant as two tiles with the right view and sizes, then stitches', async () => {
    const { service, drawScene, stitch } = build()
    const input = scene(4000, 1000)
    const png = await service.drawFull(input)
    expect(png).toEqual(JOINED_PNG)
    expect(drawScene.mock.calls).toEqual([
      [input, { width: 2048, height: 1000 }, { x: 0, y: 0 }],
      [input, { width: 1952, height: 1000 }, { x: 2048, y: 0 }],
    ])
    expect(stitch).toHaveBeenCalledWith(
      [
        { x: 0, y: 0, png: TILE_PNG },
        { x: 2048, y: 0, png: TILE_PNG },
      ],
      { width: 4000, height: 1000 },
    )
  })

  it('draws a picture that fits one draw once, at its exact size, with no stitch', async () => {
    const { service, drawScene, stitch } = build()
    const input = scene(1080, 1350)
    expect(await service.drawFull(input)).toEqual(TILE_PNG)
    expect(drawScene.mock.calls).toEqual([[input, { width: 1080, height: 1350 }]])
    expect(stitch).not.toHaveBeenCalled()
  })

  it('takes one queue item: a draw asked for meanwhile waits until every tile is done', async () => {
    let release: () => void = () => undefined
    const order: string[] = []
    const { service } = build(async (_input, size, view) => {
      order.push(view ? `tile ${view.x}` : `one ${size.width}`)
      if (view?.x === 0) await new Promise<void>((r) => (release = r))
      return { png: TILE_PNG, overflow: {} }
    })
    const full = service.drawFull(scene(4000, 1000))
    await vi.waitFor(() => expect(order).toEqual(['tile 0']))
    const other = service.drawFull(scene(100, 100))
    release()
    await Promise.all([full, other])
    expect(order).toEqual(['tile 0', 'tile 2048', 'one 100'])
  })

  it('sends no layer.reportOverflow, no event, and writes no thumbnail file', async () => {
    const { fx, service, execute, emit } = build()
    await service.drawFull(scene(4000, 1000))
    await service.drawFull(scene(1080, 1080))
    expect(execute).not.toHaveBeenCalled()
    expect(emit).not.toHaveBeenCalled()
    expect(fs.existsSync(path.join(fx.userData, 'thumbnails'))).toBe(false)
  })

  it('rejects when a tile cannot be drawn, and stitches nothing', async () => {
    const { service, stitch } = build(async (_input, _size, view) => {
      if (view?.x === 2048) throw Object.assign(new Error('x'), { reason: 'timeout' })
      return { png: TILE_PNG, overflow: {} }
    })
    await expect(service.drawFull(scene(4000, 1000))).rejects.toThrow()
    expect(stitch).not.toHaveBeenCalled()
  })
})
