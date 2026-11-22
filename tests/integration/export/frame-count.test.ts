// P8-14, named test "frame count" (spec/export-and-checks.md "Video variant") [REQ: FR-131]: a
// fixed 2,000 ms video variant at 30 fps, drawn through RenderService.drawFull over a fake draw
// and sent through the frame pipe into a counting sink, gives exactly 60 PNGs, drawn at the
// times the frame numbers give.
import { Writable } from 'node:stream'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { makeFixture, type Fixture } from '../core-fixture'
import { createRenderService } from '@/main/thumbnails/service'
import type { DrawScene } from '@/main/thumbnails/types'
import type { ExportPictures } from '@/main/export/types'
import type { SceneInput } from '@/shared/scene/types'
import { pipeFrames } from '@/main/export/video/frame-pipe'
import { frameCount, frameTimeMs } from '@/shared/export/frames'

let f: Fixture | undefined
afterEach(() => {
  f?.cleanup()
  f = undefined
})

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]
const DURATION_MS = 2000
const FPS = 30

const scene: SceneInput = {
  projectId: '01HZY3V7Q8R9S0T1V2W3X4Y5Z6',
  variant: { width: 1080, height: 1920, language: 'en', format: 'video', durationMs: DURATION_MS },
  layers: [],
  assets: {},
  timeMs: 0,
  mode: 'overlay-only',
}

// Takes one frame at a time and counts the ones that start as a PNG does.
function countingSink() {
  let pngs = 0
  let other = 0
  const stdin = new Writable({
    highWaterMark: 1,
    write(chunk: Buffer, _encoding, done) {
      const isPng = PNG_SIGNATURE.every((b, i) => chunk[i] === b)
      if (isPng) pngs++
      else other++
      setImmediate(done)
    },
  })
  const finished = new Promise<void>((resolve) => stdin.on('finish', resolve))
  return { sink: { stdin, kill: vi.fn() }, finished, counts: () => ({ pngs, other }) }
}

describe('frame count [FR-131]', () => {
  it('sends exactly 60 PNGs for a 2,000 ms variant at 30 fps', async () => {
    const fx = makeFixture()
    f = fx
    const draw = vi.fn<DrawScene>(async (input) => ({
      png: new Uint8Array([...PNG_SIGNATURE, Math.round(input.timeMs)]),
      overflow: {},
    }))
    const pictures = { toJpeg: vi.fn(), stitch: vi.fn(), shrink: vi.fn() }
    const service = createRenderService({
      deps: () => ({ ...fx.core.deps, exportPictures: pictures as unknown as ExportPictures }),
      bus: () => ({ execute: vi.fn() }),
      emit: vi.fn(),
      draw,
    })
    const { sink, finished, counts } = countingSink()
    const count = frameCount(scene.variant.durationMs, FPS)
    await pipeFrames({
      count,
      draw: (i) => service.drawFull({ ...scene, timeMs: frameTimeMs(i, FPS) }),
      sink,
      signal: new AbortController().signal,
    })
    await finished

    expect(counts()).toEqual({ pngs: 60, other: 0 })
    const times = draw.mock.calls.map(([input]) => input.timeMs)
    expect(times).toEqual(Array.from({ length: 60 }, (_, i) => (i * 1000) / FPS))
    expect(draw.mock.calls.every(([input]) => input.mode === 'overlay-only')).toBe(true)
    expect(sink.kill).not.toHaveBeenCalled()
  })
})
