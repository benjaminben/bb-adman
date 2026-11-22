// P8-17: the named frame count [FR-131] with frame reuse on. A 2,000 ms variant at 30 fps whose
// one text layer fades in over the first 500 ms still sends exactly 60 PNGs, in order; only the
// first 16 (0 to 500 ms) are drawn, the rest are the last drawn frame sent again.
import { Writable } from 'node:stream'
import { describe, expect, it, vi } from 'vitest'
import { frameReuse } from '@/main/export/video/frame-reuse'
import { pipeFrames } from '@/main/export/video/frame-pipe'
import { frameCount } from '@/shared/export/frames'
import type { SceneInput } from '@/shared/scene/types'
import { layer } from '../../unit/shared/scene/fixtures'

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]
const FPS = 30
const none = { preset: 'none' as const, startMs: 0, durationMs: 0 }

const scene: Pick<SceneInput, 'variant' | 'layers'> = {
  variant: { width: 400, height: 400, language: 'en', format: 'video', durationMs: 2000 },
  layers: [
    layer({
      id: 'headline',
      type: 'text',
      animation: { entrance: { preset: 'fade', startMs: 0, durationMs: 500 }, exit: none },
    }),
  ],
}

describe('frame count with reuse on [FR-131, P8-17]', () => {
  it('sends 60 PNGs and draws only the frames that change', async () => {
    const sent: number[] = []
    const stdin = new Writable({
      highWaterMark: 1,
      write(chunk: Buffer, _encoding, done) {
        if (PNG_SIGNATURE.every((b, i) => chunk[i] === b)) sent.push(chunk[8] as number)
        setImmediate(done)
      },
    })
    const finished = new Promise<void>((resolve) => stdin.on('finish', resolve))
    const draw = vi.fn(async (i: number) => new Uint8Array([...PNG_SIGNATURE, i]))
    await pipeFrames({
      count: frameCount(scene.variant.durationMs, FPS),
      draw,
      sameAsPrevious: frameReuse(scene, FPS),
      sink: { stdin, kill: vi.fn() },
      signal: new AbortController().signal,
    })
    await finished
    const drawn = Array.from({ length: 16 }, (_, i) => i)
    expect(draw.mock.calls.map(([i]) => i)).toEqual(drawn)
    expect(sent).toEqual([...drawn, ...Array<number>(44).fill(15)])
  })
})
