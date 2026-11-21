import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { TextStyle } from '@/shared/schemas/layer'
import type { SceneAsset, SceneVariant } from '@/shared/scene/types'

const revs = { copy: 0, style: 0, geometry: 0, source: 0, timing: 0, animation: 0 }
const still = { preset: 'none' as const, startMs: 0, durationMs: 0 }

export const textStyle: TextStyle = {
  fontAssetId: null,
  fontSize: 40,
  fontWeight: 700,
  color: '#112233',
  align: 'center',
  lineHeight: 1.2,
  letterSpacing: 0.05,
}

export const variant: SceneVariant = {
  width: 1080,
  height: 1350,
  language: 'ja-JP',
  format: 'image',
  durationMs: 0,
}

export function layer(over: Partial<LayerRow> & Pick<LayerRow, 'id' | 'type'>): LayerRow {
  const isText = over.type === 'text'
  return {
    variantId: 'v1',
    key: over.id,
    slot: null,
    name: over.id,
    z: 1,
    visible: true,
    locked: false,
    linked: false,
    overrides: [],
    copy: isText ? 'Hello' : null,
    style: isText ? textStyle : { opacity: 1 },
    geometry: { x: 10, y: 20, width: 300, height: 100, rotation: 0, crop: null },
    source: null,
    timing: { startMs: 0, endMs: null },
    animation: { entrance: still, exit: still },
    revs,
    syncedRevs: revs,
    translationStatus: null,
    translationSource: null,
    overflow: false,
    ...over,
  }
}

export function asset(over: Partial<SceneAsset> = {}): SceneAsset {
  return {
    url: 'adman-asset://p1/a1',
    kind: 'image',
    missing: false,
    width: 800,
    height: 600,
    version: 1,
    ...over,
  }
}
