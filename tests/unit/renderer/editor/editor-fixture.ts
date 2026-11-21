// A variant.get reply for the editor and variant store tests: a 1080 by 1350 post with a
// background picture, a headline and a logo picture.
import type { AssetRow } from '@/shared/schemas/rows/asset'
import type { VariantGet } from '@/shared/schemas/queries/variant'
import { layer, textStyle } from '../../shared/scene/fixtures'
import { P, variant } from '../screens/campaign/campaign-fixture'

export { P, layer, textStyle }

export const V = 'V1'

export function assetRow(
  id: string,
  over: Partial<AssetRow & { missing: boolean }> = {},
): AssetRow & { missing: boolean } {
  return {
    id,
    library: 'asset',
    kind: 'image',
    origin: 'imported',
    storage: 'linked',
    subjectId: null,
    displayName: `${id}.png`,
    absPath: `/pictures/${id}.png`,
    relPath: `${id}.png`,
    mime: 'image/png',
    byteSize: 1000,
    mtimeMs: 0,
    contentHash: 'h',
    width: 1080,
    height: 1350,
    durationMs: null,
    fontFamily: null,
    fontPublishAllowed: false,
    genRunId: null,
    genProvider: null,
    genModel: null,
    genPrompt: null,
    createdAt: '2026-11-21T00:00:00.000Z',
    missing: false,
    ...over,
  }
}

const geometry = (x: number, y: number, width: number, height: number) => ({
  x,
  y,
  width,
  height,
  rotation: 0,
  crop: null,
})

export const BACKGROUND = layer({
  id: 'L0',
  variantId: V,
  type: 'background',
  name: 'Background',
  z: 0,
  source: { assetId: 'A1' },
  geometry: geometry(0, 0, 1080, 1350),
})
export const HEADLINE = layer({
  id: 'L1',
  variantId: V,
  type: 'text',
  name: 'Headline',
  z: 1,
  copy: 'Cool down this summer',
  geometry: geometry(90, 120, 900, 200),
})
export const LOGO = layer({
  id: 'L2',
  variantId: V,
  type: 'image',
  name: 'Logo',
  z: 2,
  source: null,
  geometry: geometry(800, 1150, 200, 120),
})

export function variantGet(over: Partial<VariantGet> = {}): VariantGet {
  return {
    variant: variant(V, {
      title: 'Master post',
      isMaster: true,
      width: 1080,
      height: 1350,
      sizeLabel: '4:5',
      rev: 7,
    }),
    campaignId: 'C1',
    layers: [BACKGROUND, HEADLINE, LOGO],
    assets: [assetRow('A1')],
    ...over,
  }
}
