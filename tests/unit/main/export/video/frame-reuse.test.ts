// P8-17, spec/export-and-checks.md "Video variant" step 2: a frame is sent again without a draw
// when no animation runs and no layer starts or ends between its time and the frame before.
import { describe, expect, it } from 'vitest'
import { frameReuse } from '@/main/export/video/frame-reuse'
import type { AnimationBlock } from '@/shared/schemas/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { layer } from '../../../shared/scene/fixtures'

const video = {
  width: 400,
  height: 400,
  language: 'en',
  format: 'video' as const,
  durationMs: 2000,
}
const none: AnimationBlock = { preset: 'none', startMs: 0, durationMs: 0 }
const text = (over: Partial<LayerRow>) => layer({ id: 'headline', type: 'text', ...over })
const fadeIn = { entrance: { preset: 'fade' as const, startMs: 0, durationMs: 500 }, exit: none }

// Frame numbers 0 to 59 at 30 fps (a frame every 33.3 ms) that are reused.
function reused(layers: LayerRow[], format: 'image' | 'video' = 'video'): number[] {
  const same = frameReuse({ variant: { ...video, format }, layers }, 30)
  return Array.from({ length: 60 }, (_, i) => i).filter(same)
}
const from = (first: number) => Array.from({ length: 60 - first }, (_, k) => first + k)
const except = (...drawn: number[]) => from(1).filter((i) => !drawn.includes(i))

describe('frameReuse [P8-17]', () => {
  it.each<[string, LayerRow[], number[]]>([
    ['still layers: every frame after the first', [text({})], from(1)],
    ['no layers at all', [], from(1)],
    [
      'a fade running from 0 to 500 ms: drawn until it ends',
      [text({ animation: fadeIn })],
      from(16),
    ],
    [
      'a layer starting at 1,000 ms (frame 30): that frame is drawn',
      [text({}), layer({ id: 'logo', type: 'image', timing: { startMs: 1000, endMs: null } })],
      except(30),
    ],
    [
      'a layer ending at 1,000 ms: the frame it is gone from is drawn',
      [text({ timing: { startMs: 0, endMs: 1000 } })],
      except(30),
    ],
    [
      'an exit fade from 1,500 ms for 300 ms: drawn while it runs',
      [
        text({
          animation: {
            entrance: none,
            exit: { ...fadeIn.entrance, startMs: 1500, durationMs: 300 },
          },
        }),
      ],
      except(45, 46, 47, 48, 49, 50, 51, 52, 53, 54),
    ],
    [
      'a block with no preset over 500 ms changes nothing',
      [
        text({
          animation: { entrance: { preset: 'none', startMs: 0, durationMs: 500 }, exit: none },
        }),
      ],
      from(1),
    ],
  ])('%s', (_, layers, expected) => {
    expect(reused(layers)).toEqual(expected)
  })

  it('an image variant has no time: every frame after the first', () => {
    expect(reused([text({ animation: fadeIn })], 'image')).toEqual(from(1))
  })

  it('a frame number that is not a whole number above 0 is drawn', () => {
    const same = frameReuse({ variant: video, layers: [text({})] }, 30)
    expect([0, -1, 1.5, Number.NaN].map(same)).toEqual([false, false, false, false])
  })
})
