// Wire rows for the Phase 5 schema and stub tests: one background layer, its variant, a
// snapshot of it and its direction. Not a test file itself.
const block = { preset: 'none', startMs: 0, durationMs: 0 }
const revs = { copy: 0, style: 0, geometry: 0, source: 0, timing: 0, animation: 0 }

export const LAYER = {
  id: 'L1',
  variantId: 'V1',
  key: 'k1',
  type: 'background',
  slot: null,
  name: 'Background',
  z: 0,
  visible: true,
  locked: false,
  linked: true,
  overrides: [],
  copy: null,
  style: { opacity: 1 },
  geometry: { x: 0, y: 0, width: 1080, height: 1080, rotation: 0, crop: null },
  source: null,
  timing: { startMs: 0, endMs: null },
  animation: { entrance: block, exit: block },
  revs,
  syncedRevs: revs,
  translationStatus: null,
  translationSource: null,
  overflow: false,
}

export const VARIANT = {
  id: 'V1',
  directionId: 'D1',
  title: 'Spring',
  width: 1080,
  height: 1080,
  sizeLabel: '1x1',
  language: 'en',
  format: 'image',
  durationMs: 0,
  durationOverridden: false,
  rev: 0,
  createdBy: 'user',
  createdAt: '2026-11-21T10:00:00.000Z',
  agentChangedAt: null,
}

const CLIP = {
  id: 'K1',
  variantId: 'V1',
  assetId: 'A1',
  startMs: 0,
  inMs: 0,
  outMs: 1000,
  placement: null,
}

export const SNAPSHOT = { variant: VARIANT, subjectIds: ['S1'], layers: [LAYER], clips: [CLIP] }

export const DIRECTION = {
  id: 'D1',
  campaignId: 'C1',
  name: 'Main',
  masterVariantId: 'V1',
  sort: 0,
}
