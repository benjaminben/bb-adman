import { describe, it, expect } from 'vitest'
import { layoutPatches } from '@/shared/generation/layout-patches'
import type { LayoutJobBox } from '@/shared/schemas/jobs/layout-proposal'

const box = (slot: string, color: string | null): LayoutJobBox => ({
  slot,
  x: 1,
  y: 2,
  width: 30,
  height: 40,
  fontSize: 12,
  color,
  align: 'right',
})

const layers = [
  { id: 'l-head', key: 'headline', type: 'text' as const },
  { id: 'l-cta', key: 'cta', type: 'text' as const },
  { id: 'l-logo', key: 'logo', type: 'image' as const },
]

describe('layoutPatches [spec/ai-jobs.md "Layout proposal", applying]', () => {
  it('gives each matching text layer its geometry with rotation 0 and its style', () => {
    expect(layoutPatches([box('headline', '#ABCDEF')], layers)).toEqual([
      {
        layerId: 'l-head',
        patch: {
          geometry: { x: 1, y: 2, width: 30, height: 40, rotation: 0 },
          style: { fontSize: 12, align: 'right', color: '#ABCDEF' },
        },
      },
    ])
  })

  it('leaves the colour out when the box has none', () => {
    const [update] = layoutPatches([box('cta', null)], layers)
    expect(update?.patch.style).toEqual({ fontSize: 12, align: 'right' })
  })

  it('skips a box whose key is not a text layer of the variant', () => {
    expect(layoutPatches([box('logo', null), box('gone', null)], layers)).toEqual([])
  })

  it('keeps the order of the boxes', () => {
    const ids = layoutPatches([box('cta', null), box('headline', null)], layers).map(
      (u) => u.layerId,
    )
    expect(ids).toEqual(['l-cta', 'l-head'])
  })
})
