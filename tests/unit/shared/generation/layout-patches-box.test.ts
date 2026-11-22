// R2E-2 (spec/phases/round-2-editor.md D2, "Applying"): a box the contrast check gave a text
// box puts its colour and padding in the style patch; `readable` never reaches a layer.
import { describe, it, expect } from 'vitest'
import { layoutPatches } from '@/shared/generation/layout-patches'
import type { LayoutJobBox } from '@/shared/schemas/jobs/layout-proposal'

const box = (over: Partial<LayoutJobBox>): LayoutJobBox => ({
  slot: 'headline',
  x: 1,
  y: 2,
  width: 30,
  height: 40,
  fontSize: 12,
  color: null,
  align: 'left',
  ...over,
})

const layers = [{ id: 'l-head', key: 'headline', type: 'text' }]

describe('layoutPatches with a text box [D2 "Applying"]', () => {
  it('adds boxColor and boxPadding to the style patch', () => {
    const [patch] = layoutPatches(
      [box({ color: '#FFFFFF', boxColor: '#000000', boxPadding: 3, readable: 'box' })],
      layers,
    )
    expect(patch?.patch.style).toEqual({
      fontSize: 12,
      align: 'left',
      color: '#FFFFFF',
      boxColor: '#000000',
      boxPadding: 3,
    })
  })

  it('leaves the style patch as before for a kept or recoloured box', () => {
    const [kept, recoloured] = layoutPatches(
      [box({ readable: 'kept' }), box({ color: '#123456', readable: 'colour' })],
      [...layers, ...layers],
    )
    expect(kept?.patch.style).toEqual({ fontSize: 12, align: 'left' })
    expect(recoloured?.patch.style).toEqual({ fontSize: 12, align: 'left', color: '#123456' })
  })
})
