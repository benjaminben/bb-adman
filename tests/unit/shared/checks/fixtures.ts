import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { TextStyle } from '@/shared/schemas/layer'
import type { CheckInput } from '@/shared/checks/types'

const revs = { copy: 0, style: 0, geometry: 0, source: 0, timing: 0, animation: 0 }
const still = { preset: 'none' as const, startMs: 0, durationMs: 0 }

export const textStyle: TextStyle = {
  fontAssetId: null,
  fontSize: 40,
  fontWeight: 700,
  color: '#112233',
  align: 'center',
  lineHeight: 1.2,
  letterSpacing: 0,
}

type LayerOver = Partial<Omit<LayerRow, 'geometry'>> & {
  geometry?: Partial<LayerRow['geometry']>
}

export function layer(id: string, type: LayerRow['type'], over: LayerOver = {}): LayerRow {
  const isText = type === 'text'
  const { geometry, ...rest } = over
  return {
    id,
    variantId: 'v1',
    key: id,
    type,
    slot: null,
    name: id,
    z: 1,
    visible: true,
    locked: false,
    linked: false,
    overrides: [],
    copy: isText ? 'Zorblat' : null,
    style: isText ? textStyle : { opacity: 1 },
    geometry: { x: 10, y: 20, width: 300, height: 100, rotation: 0, crop: null, ...geometry },
    source: null,
    timing: { startMs: 0, endMs: null },
    animation: { entrance: still, exit: still },
    revs,
    syncedRevs: revs,
    translationStatus: null,
    translationSource: null,
    overflow: false,
    ...rest,
  }
}

export function text(id: string, copy: string | null, over: LayerOver = {}): LayerRow {
  return layer(id, 'text', { copy, ...over })
}

export function textColoured(id: string, color: string, over: LayerOver = {}): LayerRow {
  return layer(id, 'text', { style: { ...textStyle, color }, ...over })
}

export function picture(id: string, assetId: string, over: LayerOver = {}): LayerRow {
  return layer(id, 'image', { source: { assetId }, ...over })
}

type InputOver = Partial<Omit<CheckInput, 'variant' | 'ruleSet'>> & {
  variant?: Partial<CheckInput['variant']>
  ruleSet?: Partial<CheckInput['ruleSet']>
}

export function input(over: InputOver = {}): CheckInput {
  return {
    primaryLanguage: over.primaryLanguage ?? 'en-GB',
    layers: over.layers ?? [],
    assetNames: over.assetNames ?? {},
    variant: {
      format: 'image',
      width: 1000,
      height: 1000,
      durationMs: 0,
      language: 'en-GB',
      ...over.variant,
    },
    ruleSet: {
      requiredAssetIds: [],
      palette: [],
      requiredWords: {},
      prohibitedWords: {},
      ...over.ruleSet,
    },
  }
}
