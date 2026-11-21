import { describe, it, expect } from 'vitest'
import { adapters } from '@/main/providers/fake'
import { greyPng } from '@/main/providers/fake/png'
import type { AdapterContext, LayoutProvider, RunOptions } from '@/main/providers/types'
import { describeSwitches } from './fake-switches'

const ctx = {} as AdapterContext
const layout = (): LayoutProvider => {
  const build = adapters.layout
  if (!build) throw new Error('fake has no layout part')
  return build(ctx)
}

const base = {
  background: { bytes: greyPng(4, 4), mime: 'image/png' },
  width: 1080,
  height: 1080,
  palette: ['#112233', '#445566'],
  fonts: [],
}
const propose = (
  items: Array<{ slot: string; text: string }>,
  extra: Partial<typeof base> = {},
  opts?: RunOptions,
) => layout().propose({ ...base, ...extra, items }, opts)

describe('fake provider, layout [spec/ai-jobs.md "The fake provider\'s parts"]', () => {
  it('places the headline and call to action in their default boxes and styles', async () => {
    const boxes = await propose([
      { slot: 'headline', text: 'Big news' },
      { slot: 'call-to-action', text: 'Shop now' },
    ])
    expect(boxes).toEqual([
      {
        slot: 'headline',
        ...{ x: 65, y: 756, width: 950, height: 173 },
        ...{ fontSize: 76, color: '#112233', align: 'center' },
      },
      {
        slot: 'call-to-action',
        ...{ x: 65, y: 950, width: 950, height: 65 },
        ...{ fontSize: 38, color: '#112233', align: 'center' },
      },
    ])
  })

  it('stacks other items one box-height apart from the other copy box', async () => {
    const boxes = await propose([
      { slot: 'tagline', text: 'a' },
      { slot: 'headline', text: 'b' },
      { slot: 'legal', text: 'c' },
    ])
    expect(boxes.map((b) => [b.slot, b.x, b.y, b.width, b.height, b.fontSize])).toEqual([
      ['tagline', 65, 454, 950, 173, 76],
      ['headline', 65, 756, 950, 173, 76],
      ['legal', 65, 627, 950, 173, 76],
    ])
  })

  it('keeps stacked items inside the canvas', async () => {
    const items = Array.from({ length: 6 }, (_, i) => ({ slot: `extra-${i}`, text: 'x' }))
    const boxes = await propose(items, { width: 1080, height: 1920 })
    for (const b of boxes) {
      expect(b.y).toBeGreaterThanOrEqual(0)
      expect(b.y + b.height).toBeLessThanOrEqual(1920)
      expect(b.x + b.width).toBeLessThanOrEqual(1080)
    }
    expect(boxes.at(-1)?.y).toBe(1920 - 307)
  })

  it('colours the text white when there is no palette', async () => {
    const [box] = await propose([{ slot: 'headline', text: 'b' }], { palette: [] })
    expect(box?.color).toBe('#FFFFFF')
  })
})

describeSwitches('layout', (opts) => propose([{ slot: 'headline', text: 'b' }], {}, opts))
