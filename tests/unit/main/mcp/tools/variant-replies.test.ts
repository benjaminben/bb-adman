// P10-2 (A-235, A-249): the list_subjects and get_variant pickers name every field they pass
// on. Each input below holds a planted key at every level (and the asset's stored path, hash,
// MIME type, size, time and prompt), and each expected reply is written out in full, so a field
// not named here never reaches an agent.
import { describe, it, expect } from 'vitest'
import { subjectListFields, variantFields } from '@/main/mcp/tools/variant-replies'

const ctx = { providers: [] }
const PLANT = { plantedKey: 'made-up-planted-value' }

const block = (preset: string) => ({ preset, startMs: 0, durationMs: 400, ...PLANT })
const revs = (n: number) => ({
  copy: n,
  style: n,
  geometry: n,
  source: n,
  timing: n,
  animation: n,
  ...PLANT,
})

const layerBase = (n: number) => ({
  variantId: 'v1',
  slot: 'headline',
  z: n,
  visible: true,
  locked: false,
  linked: true,
  overrides: ['copy'],
  copy: 'Stay cool',
  geometry: {
    x: 1,
    y: 2,
    width: 3,
    height: 4,
    rotation: 5,
    crop: { x: 6, y: 7, width: 8, height: 9, ...PLANT },
    ...PLANT,
  },
  timing: { startMs: 0, endMs: null, ...PLANT },
  animation: { entrance: block('fade'), exit: block('none'), ...PLANT },
  revs: revs(1),
  syncedRevs: revs(0),
  translationStatus: 'approved',
  translationSource: 'user',
  overflow: false,
  ...PLANT,
})

const TEXT_STYLE = {
  fontAssetId: 'f1',
  fontSize: 40,
  fontWeight: 700,
  color: '#112233',
  align: 'center',
  lineHeight: 1.2,
  letterSpacing: 0.1,
  verticalAlign: 'middle',
  allCaps: true,
  boxColor: '#000000',
  boxOutlineColor: '#FFFFFF',
  boxOutlineWidth: 2,
  boxRadius: 8,
  boxPadding: 12,
}
const SHADE = { color: '#000000', from: 'bottom', strength: 0.5, reach: 0.4 }

const variantRow = {
  id: 'v1',
  directionId: 'd1',
  title: 'Summer',
  width: 1080,
  height: 1080,
  sizeLabel: '1x1',
  language: 'en',
  format: 'image',
  durationMs: 6000,
  durationOverridden: false,
  rev: 3,
  createdBy: 'user',
  createdAt: '2026-01-01T00:00:00Z',
  agentChangedAt: null,
  firstClipMade: false,
  sound: 'none',
  soundAssetId: null,
  isMaster: true,
  subjectIds: ['s1'],
}
const BADGES = {
  jobRunning: false,
  resultUnseen: true,
  outOfDate: false,
  overflow: false,
  translationUnapproved: true,
  checkWarning: false,
  checkStale: false,
  missingFile: true,
}

const assetOut = {
  id: 'a1',
  displayName: 'Picture',
  kind: 'image',
  library: 'asset',
  subjectId: 's1',
  width: 640,
  height: 480,
  durationMs: null,
  fontFamily: null,
  missing: true,
}
const HIDDEN_ASSET = {
  origin: 'imported',
  storage: 'linked',
  absPath: '/made-up/outside/picture.png',
  relPath: '../outside/picture.png',
  mime: 'image/png',
  byteSize: 1234,
  mtimeMs: 99,
  contentHash: 'made-up-hash',
  fontPublishAllowed: false,
  genRunId: 'made-up-run',
  genProvider: 'made-up-provider',
  genModel: 'made-up-model',
  genPrompt: 'made-up prompt words',
  createdAt: '2026-01-01T00:00:00Z',
}

const variantIn = {
  variant: { ...variantRow, badges: { ...BADGES, ...PLANT }, ...PLANT },
  campaignId: 'c1',
  layers: [
    {
      ...layerBase(0),
      id: 'l1',
      key: 'k1',
      type: 'background',
      name: 'Background',
      style: { opacity: 1, fillColor: '#FF0000', shade: { ...SHADE, ...PLANT }, ...PLANT },
      source: { assetId: 'a1', ...PLANT },
    },
    {
      ...layerBase(1),
      id: 'l2',
      key: 'k2',
      type: 'text',
      name: 'Headline',
      style: { ...TEXT_STYLE, ...PLANT },
      source: null,
    },
  ],
  assets: [{ ...assetOut, ...HIDDEN_ASSET, ...PLANT }],
  ...PLANT,
}

const strip = <T extends Record<string, unknown>>(o: T) => {
  const { plantedKey: _, ...rest } = o
  return rest
}
const layerOut = (n: number) => ({
  ...strip(layerBase(n)),
  geometry: {
    x: 1,
    y: 2,
    width: 3,
    height: 4,
    rotation: 5,
    crop: { x: 6, y: 7, width: 8, height: 9 },
  },
  timing: { startMs: 0, endMs: null },
  animation: {
    entrance: { preset: 'fade', startMs: 0, durationMs: 400 },
    exit: { preset: 'none', startMs: 0, durationMs: 400 },
  },
  revs: strip(revs(1)),
  syncedRevs: strip(revs(0)),
})

describe('the get_variant picker [P10-2, A-249]', () => {
  it('gives exactly the named fields of the variant, its layers and its assets', () => {
    expect(variantFields(variantIn, ctx)).toStrictEqual({
      variant: { ...variantRow, badges: BADGES },
      campaignId: 'c1',
      layers: [
        {
          ...layerOut(0),
          id: 'l1',
          key: 'k1',
          type: 'background',
          name: 'Background',
          style: { opacity: 1, fillColor: '#FF0000', shade: SHADE },
          source: { assetId: 'a1' },
        },
        {
          ...layerOut(1),
          id: 'l2',
          key: 'k2',
          type: 'text',
          name: 'Headline',
          style: TEXT_STYLE,
          source: null,
        },
      ],
      assets: [assetOut],
    })
  })

  it('leaves an absent look field absent, not set to undefined', () => {
    const bare = {
      ...variantIn,
      layers: [
        { ...variantIn.layers[0], style: { opacity: 0.5 } },
        { ...variantIn.layers[1], style: strip({ ...TEXT_STYLE, plantedKey: '' }) },
      ],
    }
    const text = (bare.layers[1] as { style: Record<string, unknown> }).style
    for (const k of ['verticalAlign', 'allCaps', 'boxColor', 'boxPadding']) delete text[k]
    const out = variantFields(bare, ctx) as { layers: Array<{ style: object }> }
    expect(Object.keys(out.layers[0]?.style ?? {})).toEqual(['opacity'])
    expect(Object.keys(out.layers[1]?.style ?? {})).not.toContain('verticalAlign')
    expect(Object.keys(out.layers[1]?.style ?? {})).not.toContain('boxPadding')
  })
})

describe('the list_subjects picker [P10-2, A-235]', () => {
  it('gives exactly id, name, description and asset IDs of each subject', () => {
    const data = [
      { id: 's1', name: 'Can', description: 'A red can', assetIds: ['a1', 'a2'], ...PLANT },
      { id: 's2', name: 'Box', description: '', assetIds: [], createdAt: '2026-01-01' },
    ]
    expect(subjectListFields(data, ctx)).toStrictEqual([
      { id: 's1', name: 'Can', description: 'A red can', assetIds: ['a1', 'a2'] },
      { id: 's2', name: 'Box', description: '', assetIds: [] },
    ])
  })
})
