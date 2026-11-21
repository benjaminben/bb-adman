// P4-1 (spec/ai-jobs.md "Contracts"): the Phase 4 job, command and query schemas. One table:
// for each schema a good value, then each field changed to a value it must refuse.
import { describe, it, expect } from 'vitest'
import type { z } from 'zod'
import { COPY_MAX_CHARS, MAX_COPY_OPTIONS } from '@/shared/config/copy-options'
import { layoutJobRequest, layoutJobResult } from '@/shared/schemas/jobs/layout-proposal'
import { copyJobRequest, copyJobResult } from '@/shared/schemas/jobs/copy-options'
import { briefJobRequest, briefJobResult } from '@/shared/schemas/jobs/brief-extraction'
import { cutoutJobRequest, cutoutJobResult } from '@/shared/schemas/jobs/cutout'
import {
  generationCopyOptionsInput,
  generationCutOutInput,
  generationProposeLayoutInput,
} from '@/shared/schemas/commands/generation'
import { briefExtractInput } from '@/shared/schemas/commands/brief'
import { layerUpdateManyInput } from '@/shared/schemas/commands/layer'
import { jobEarlierOptionsInput } from '@/shared/schemas/queries/earlier-options'
import { jobActivityInput } from '@/shared/schemas/queries/activity'
import { campaignPaidCountInput } from '@/shared/schemas/queries/paid-count'

const box = {
  slot: 'headline',
  x: 10,
  y: 20,
  width: 300,
  height: 80,
  fontSize: 48,
  color: '#FFAA00',
  align: 'center',
}
const scoped = { projectId: 'p1', variantId: 'v1' }
const updates = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ layerId: `l${i}`, patch: { visible: false } }))

type Case = [string, z.ZodType, Record<string, unknown>, Array<[string, unknown]>]

const CASES: Case[] = [
  ['layoutJobRequest', layoutJobRequest, {}, [['variantId', 'v1']]],
  [
    'layoutJobResult',
    layoutJobResult,
    { boxes: [box, { ...box, slot: 'call-to-action', color: null, align: 'left' }] },
    [
      ['boxes', [{ ...box, x: 1.5 }]],
      ['boxes', [{ ...box, fontSize: '48' }]],
      ['boxes', [{ ...box, color: 'red' }]],
      ['boxes', [{ ...box, color: '#FFAA0' }]],
      ['boxes', [{ ...box, align: 'justify' }]],
      ['boxes', [{ ...box, slot: undefined }]],
      ['boxes', undefined],
    ],
  ],
  [
    'copyJobRequest',
    copyJobRequest,
    { role: 'call_to_action', language: 'en-US', count: 3, maxChars: 40 },
    [
      ['role', 'headline'],
      ['language', ''],
      ['count', 0],
      ['count', MAX_COPY_OPTIONS + 1],
      ['count', 2.5],
      ['maxChars', 0],
    ],
  ],
  ['copyJobResult', copyJobResult, { options: ['Shop now'] }, [['options', ['']]]],
  ['briefJobRequest', briefJobRequest, { text: 'Campaign name: Spring' }, [['text', '']]],
  [
    'briefJobResult',
    briefJobResult,
    { draft: { campaignName: 'Spring' }, primaryLanguage: null },
    [
      ['draft', undefined],
      ['primaryLanguage', undefined],
    ],
  ],
  ['cutoutJobRequest', cutoutJobRequest, { sourceAssetId: 'a1' }, [['sourceAssetId', '']]],
  ['cutoutJobResult', cutoutJobResult, { assetIds: ['a2'] }, [['assetIds', [2]]]],
  [
    'generationProposeLayoutInput',
    generationProposeLayoutInput,
    { ...scoped, provider: 'fake' },
    [
      ['projectId', ''],
      ['variantId', ''],
      ['provider', undefined],
    ],
  ],
  [
    'generationCopyOptionsInput',
    generationCopyOptionsInput,
    { ...scoped, layerId: 'l1', count: MAX_COPY_OPTIONS, provider: 'fake' },
    [
      ['layerId', ''],
      ['count', 0],
      ['count', MAX_COPY_OPTIONS + 1],
      ['count', 1.5],
      ['provider', undefined],
    ],
  ],
  [
    'generationCutOutInput',
    generationCutOutInput,
    { ...scoped, layerId: 'l1', provider: 'comfyui', licenceConfirmed: true },
    [
      ['variantId', undefined],
      ['layerId', ''],
      ['provider', undefined],
      ['licenceConfirmed', false],
    ],
  ],
  [
    'briefExtractInput',
    briefExtractInput,
    { projectId: 'p1', filePath: '/briefs/spring.md', provider: 'fake' },
    [
      ['filePath', ''],
      ['filePath', undefined],
      ['provider', undefined],
    ],
  ],
  [
    'layerUpdateManyInput',
    layerUpdateManyInput,
    { ...scoped, updates: updates(1) },
    [
      ['updates', []],
      ['updates', updates(101)],
      ['updates', [{ layerId: '', patch: { visible: false } }]],
      ['updates', [{ layerId: 'l1', patch: {} }]],
      ['updates', [{ layerId: 'l1', patch: { colour: 'red' } }]],
      ['updates', [{ layerId: 'l1', patch: { visible: false }, extra: 1 }]],
      ['variantId', undefined],
      ['extra', 1],
    ],
  ],
  [
    'jobEarlierOptionsInput',
    jobEarlierOptionsInput,
    { projectId: 'p1', layerId: 'l1' },
    [
      ['projectId', undefined],
      ['layerId', ''],
    ],
  ],
  [
    'jobActivityInput',
    jobActivityInput,
    { projectId: 'p1', limit: 500 },
    [
      ['limit', 0],
      ['limit', 501],
      ['limit', 1.5],
    ],
  ],
  [
    'campaignPaidCountInput',
    campaignPaidCountInput,
    { projectId: 'p1', campaignId: 'c1' },
    [['campaignId', '']],
  ],
]

describe('Phase 4 schemas [spec/ai-jobs.md "Contracts"]', () => {
  it.each(CASES)('%s accepts its good value', (_name, schema, good) => {
    expect(schema.safeParse(good).success).toBe(true)
  })

  const refusals = CASES.flatMap(([name, schema, good, bad]) =>
    bad.map(([field, value]) => [name, field, value, schema, good] as const),
  )
  it.each(refusals)('%s refuses %s = %j', (_name, field, value, schema, good) => {
    expect(schema.safeParse({ ...good, [field]: value }).success).toBe(false)
  })
})

describe('Phase 4 bounds', () => {
  it('copy options: at most eight, and the character limit per role', () => {
    expect(MAX_COPY_OPTIONS).toBe(8)
    expect(COPY_MAX_CHARS).toEqual({ call_to_action: 40, text: 120 })
  })

  it('layer.updateMany takes 1 to 100 updates', () => {
    expect(layerUpdateManyInput.safeParse({ ...scoped, updates: updates(100) }).success).toBe(true)
  })

  it('job.activity has a limit of 200 when none is given', () => {
    expect(jobActivityInput.parse({ projectId: 'p1' })).toEqual({ projectId: 'p1', limit: 200 })
  })

  it('generation inputs drop unknown keys, so no workflow can be named', () => {
    const parsed = generationCutOutInput.parse({
      ...scoped,
      layerId: 'l1',
      provider: 'comfyui',
      workflowId: 'w',
    })
    expect(parsed).not.toHaveProperty('workflowId')
  })
})
