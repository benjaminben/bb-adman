// spec/editor.md "Layout…" (LK-6): the previews draw the variant's layers with a layout's
// updates merged in. Style and geometry are merged field by field, as layer.update does.
import { describe, expect, it } from 'vitest'
import { applyPatches } from '@/renderer/dialogs/layout-dialog/apply-patches'
import { STARTER_LAYOUTS } from '@/shared/config/starter-layouts'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { StarterLayout } from '@/shared/config/default-layout'
import { starterLayoutPatches } from '@/shared/templates/starter-layout-patches'
import { layer, textStyle } from '../../shared/scene/fixtures'

const crop = { x: 0.1, y: 0.1, width: 0.5, height: 0.5 }
const BACKGROUND = layer({
  id: 'background',
  type: 'background',
  source: { assetId: 'A1' },
  geometry: { x: 5, y: 5, width: 50, height: 50, rotation: 12, crop },
})
const HEADLINE = layer({
  id: 'headline',
  type: 'text',
  copy: 'Cool down this summer',
  style: { ...textStyle, fontAssetId: 'F1', boxColor: '#123456' },
})
const OTHER = layer({ id: 'extra', type: 'text' })
const [PHOTO_BOTTOM_LEFT, PHOTO_TOP_CENTRE] = STARTER_LAYOUTS as [StarterLayout, StarterLayout]

describe('applyPatches [spec/editor.md "Layout…", LK-6]', () => {
  it('merges each update into its layer and leaves the others alone', () => {
    const layers = [BACKGROUND, HEADLINE, OTHER]
    const updates = starterLayoutPatches(PHOTO_BOTTOM_LEFT, { width: 1080, height: 1080 }, layers)
    const merged = applyPatches(layers, updates)
    const [background, headline, other] = merged as [LayerRow, LayerRow, LayerRow]
    const patchOf = (id: string) => updates.find((u) => u.layerId === id)?.patch

    expect(background.geometry).toEqual({ ...patchOf('background')?.geometry, crop })
    expect(background.style).toEqual({ opacity: 1, ...patchOf('background')?.style })
    expect(background.source).toEqual({ assetId: 'A1' })
    expect(headline.style).toEqual({ ...HEADLINE.style, ...patchOf('headline')?.style })
    expect(headline.style).toMatchObject({ fontAssetId: 'F1', boxColor: null })
    expect(headline.copy).toBe('Cool down this summer')
    expect(other).toBe(OTHER)
  })

  it('does not change the layers it was given', () => {
    const layers = [BACKGROUND, HEADLINE]
    const before = structuredClone(layers)
    const updates = starterLayoutPatches(PHOTO_TOP_CENTRE, { width: 900, height: 1600 }, layers)
    applyPatches(layers, updates)
    expect(layers).toEqual(before)
  })

  it('gives the layers back as they are when there is no update', () => {
    expect(applyPatches([BACKGROUND], [])).toEqual([BACKGROUND])
  })
})
