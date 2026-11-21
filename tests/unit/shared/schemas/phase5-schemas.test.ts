// P5-1 (spec/phases/phase-05-slices.md): the Phase 5 inputs, query and job shapes, each strict
// and as spec/links-and-sync.md gives them. One good value per schema, then each refusal.
import { describe, it, expect } from 'vitest'
import type { z } from 'zod'
import {
  directionCreateFromMasterInput,
  directionDeleteInput,
  directionRenameInput,
  directionRestoreInput,
} from '@/shared/schemas/commands/direction'
import {
  variantAddInput,
  variantDeleteInput,
  variantFanOutInput,
  variantRemoveInput,
  variantRestoreInput,
  variantRestoreLayersInput,
} from '@/shared/schemas/commands/variant'
import { layerClearOverrideInput, layerRevertInput } from '@/shared/schemas/commands/layer'
import { syncApplyInput } from '@/shared/schemas/commands/sync'
import {
  generationApplyFillInput,
  generationRunFillInput,
} from '@/shared/schemas/commands/generation'
import { syncPreviewInput } from '@/shared/schemas/queries/sync'
import {
  generativeFillJobRequest,
  generativeFillJobResult,
} from '@/shared/schemas/jobs/generative-fill'

const p = { projectId: 'P1' }
const block = { preset: 'none', startMs: 0, durationMs: 0 }
const revs = { copy: 0, style: 0, geometry: 0, source: 0, timing: 0, animation: 0 }
const layer = {
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
const variant = {
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
const clip = { id: 'K1', variantId: 'V1', assetId: 'A1', startMs: 0, inMs: 0, outMs: 1000 }
const snapshot = {
  variant,
  subjectIds: ['S1'],
  layers: [layer],
  clips: [{ ...clip, placement: null }],
}
const direction = { id: 'D1', campaignId: 'C1', name: 'Main', masterVariantId: 'V1', sort: 0 }
const decision = {
  variantId: 'V2',
  layerKey: 'k1',
  accept: true,
  overrides: [{ path: 'style.color', choice: 'keep-mine' }],
}
const many = <T>(n: number, of: (i: number) => T): T[] => Array.from({ length: n }, (_, i) => of(i))
const long = 'a'.repeat(101)

type Case = {
  name: string
  schema: z.ZodType
  good: Record<string, unknown>
  required: string
  bad?: Array<[string, Record<string, unknown>]>
}

const name = (good: Record<string, unknown>): Array<[string, Record<string, unknown>]> => [
  ['an empty name', { ...good, name: '   ' }],
  ['a name of 101 characters', { ...good, name: long }],
]

const fanOut = {
  ...p,
  directionId: 'D1',
  sizes: ['9x16'],
  languages: ['en'],
  formats: ['image'],
  fits: { '9x16': 'crop' },
}
const createFromMaster = { ...p, masterVariantId: 'V1', name: 'Bold' }
const rename = { ...p, directionId: 'D1', name: 'Bold' }

const CASES: Case[] = [
  {
    name: 'direction.createFromMaster',
    schema: directionCreateFromMasterInput,
    good: createFromMaster,
    required: 'masterVariantId',
    bad: name(createFromMaster),
  },
  {
    name: 'direction.rename',
    schema: directionRenameInput,
    good: rename,
    required: 'directionId',
    bad: name(rename),
  },
  {
    name: 'direction.delete',
    schema: directionDeleteInput,
    good: { ...p, directionId: 'D1' },
    required: 'directionId',
  },
  {
    name: 'direction.restore',
    schema: directionRestoreInput,
    good: { ...p, direction, variants: [snapshot] },
    required: 'direction',
    bad: [
      ['a snapshot with an unknown key', { ...p, direction, variants: [{ ...snapshot, x: 1 }] }],
    ],
  },
  {
    name: 'variant.fanOut',
    schema: variantFanOutInput,
    good: fanOut,
    required: 'fits',
    bad: [
      ["formats ['video']", { ...fanOut, formats: ['video'] }],
      ['no format', { ...fanOut, formats: [] }],
      ['no size', { ...fanOut, sizes: [] }],
      ['no language', { ...fanOut, languages: [] }],
      ['a fit outside the three', { ...fanOut, fits: { '9x16': 'stretch' } }],
    ],
  },
  {
    name: 'variant.add',
    schema: variantAddInput,
    good: {
      ...p,
      directionId: 'D1',
      sizeLabel: '9x16',
      language: 'fr',
      format: 'image',
      fit: 'crop',
    },
    required: 'sizeLabel',
    bad: [
      [
        'fit fill',
        {
          ...p,
          directionId: 'D1',
          sizeLabel: '9x16',
          language: 'fr',
          format: 'image',
          fit: 'fill',
        },
      ],
      [
        'format video',
        { ...p, directionId: 'D1', sizeLabel: '9x16', language: 'fr', format: 'video' },
      ],
    ],
  },
  {
    name: 'variant.delete',
    schema: variantDeleteInput,
    good: { ...p, variantId: 'V1' },
    required: 'variantId',
  },
  {
    name: 'variant.remove',
    schema: variantRemoveInput,
    good: { ...p, variantIds: ['V1'] },
    required: 'variantIds',
    bad: [
      ['no variant', { ...p, variantIds: [] }],
      ['variantIds of 501 entries', { ...p, variantIds: many(501, (i) => `V${i}`) }],
    ],
  },
  {
    name: 'variant.restore',
    schema: variantRestoreInput,
    good: { ...p, snapshots: [snapshot] },
    required: 'snapshots',
    bad: [
      ['no snapshot', { ...p, snapshots: [] }],
      ['snapshots of 501 entries', { ...p, snapshots: many(501, () => snapshot) }],
    ],
  },
  {
    name: 'variant.restoreLayers',
    schema: variantRestoreLayersInput,
    good: { ...p, variants: [{ variantId: 'V1', layers: [layer] }] },
    required: 'variants',
    bad: [
      ['no variant', { ...p, variants: [] }],
      [
        'variants of 501 entries',
        { ...p, variants: many(501, (i) => ({ variantId: `V${i}`, layers: [] })) },
      ],
    ],
  },
  {
    name: 'layer.clearOverride',
    schema: layerClearOverrideInput,
    good: { ...p, layerId: 'L1', paths: ['style.color'] },
    required: 'paths',
    bad: [['no path', { ...p, layerId: 'L1', paths: [] }]],
  },
  {
    name: 'layer.revert',
    schema: layerRevertInput,
    good: {
      ...p,
      variantId: 'V1',
      layers: [{ layerId: 'L1', patch: { copy: 'Hi' }, overrides: ['copy'] }],
    },
    required: 'layers',
    bad: [
      ['no layer', { ...p, variantId: 'V1', layers: [] }],
      [
        '101 layers',
        {
          ...p,
          variantId: 'V1',
          layers: many(101, (i) => ({ layerId: `L${i}`, patch: {}, overrides: [] })),
        },
      ],
      [
        'a patch with an unknown key',
        { ...p, variantId: 'V1', layers: [{ layerId: 'L1', patch: { z: 1 }, overrides: [] }] },
      ],
    ],
  },
  {
    name: 'sync.apply',
    schema: syncApplyInput,
    good: { ...p, directionId: 'D1', masterRev: 3, decisions: [decision] },
    required: 'masterRev',
    bad: [
      [
        'decisions of 2,001',
        { ...p, directionId: 'D1', masterRev: 3, decisions: many(2001, () => decision) },
      ],
      [
        'a choice outside the two',
        {
          ...p,
          directionId: 'D1',
          masterRev: 3,
          decisions: [{ ...decision, overrides: [{ path: 'copy', choice: 'both' }] }],
        },
      ],
      ['a negative masterRev', { ...p, directionId: 'D1', masterRev: -1, decisions: [] }],
    ],
  },
  {
    name: 'generation.runFill',
    schema: generationRunFillInput,
    good: { ...p, variantId: 'V1', provider: 'fake', licenceConfirmed: true },
    required: 'provider',
    bad: [
      [
        'licenceConfirmed false',
        { ...p, variantId: 'V1', provider: 'fake', licenceConfirmed: false },
      ],
    ],
  },
  {
    name: 'generation.applyFill',
    schema: generationApplyFillInput,
    good: { ...p, jobId: 'J1' },
    required: 'jobId',
  },
  {
    name: 'sync.preview',
    schema: syncPreviewInput,
    good: { ...p, directionId: 'D1' },
    required: 'directionId',
  },
]

const JOB_REQUEST = {
  prompt: 'Extend this picture.',
  sourceAssetId: 'A1',
  placement: { x: 10, y: 20, width: 500, height: 400 },
  width: 1080,
  height: 1920,
}

describe('Phase 5 input schemas [P5-1, spec/links-and-sync.md]', () => {
  it.each(CASES)('$name accepts a good value', ({ schema, good }) => {
    expect(schema.safeParse(good).success).toBe(true)
  })

  it.each(CASES)(
    '$name refuses a missing field and an unknown key',
    ({ schema, good, required }) => {
      const missing = Object.fromEntries(Object.entries(good).filter(([k]) => k !== required))
      expect(schema.safeParse(missing).success).toBe(false)
      expect(schema.safeParse({ ...good, extra: 1 }).success).toBe(false)
      const noProject = Object.fromEntries(Object.entries(good).filter(([k]) => k !== 'projectId'))
      expect(schema.safeParse(noProject).success).toBe(false)
    },
  )

  const bad = CASES.flatMap((c) => (c.bad ?? []).map(([label, value]) => ({ c, label, value })))
  it.each(bad)('$c.name refuses $label', ({ c, value }) => {
    expect(c.schema.safeParse(value).success).toBe(false)
  })

  it('variant.add takes no fit as scale, and fit is optional', () => {
    const input = { ...p, directionId: 'D1', sizeLabel: '9x16', language: 'fr', format: 'image' }
    expect(variantAddInput.safeParse(input).success).toBe(true)
  })

  it('trims a direction name', () => {
    expect(directionRenameInput.parse({ ...rename, name: '  Bold  ' }).name).toBe('Bold')
  })
})

describe('the generative_fill job shapes [P5-1, spec/links-and-sync.md "Generative fill"]', () => {
  it('reads a request and a result', () => {
    expect(generativeFillJobRequest.parse(JOB_REQUEST)).toEqual(JOB_REQUEST)
    expect(generativeFillJobResult.parse({ assetIds: ['A2'] })).toEqual({ assetIds: ['A2'] })
  })

  it.each<[string, Record<string, unknown>]>([
    ['no prompt', { ...JOB_REQUEST, prompt: '' }],
    ['no source', { ...JOB_REQUEST, sourceAssetId: '' }],
    ['a placement of no width', { ...JOB_REQUEST, placement: { x: 0, y: 0, width: 0, height: 1 } }],
    ['a canvas of no height', { ...JOB_REQUEST, height: 0 }],
  ])('refuses a request with %s', (_label, value) => {
    expect(generativeFillJobRequest.safeParse(value).success).toBe(false)
  })
})
