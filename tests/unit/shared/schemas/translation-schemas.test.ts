// P6-1 (spec/phases/phase-06.md, design additions 1, 2, 5): the Phase 6 inputs, the job's
// request and result, and the variant_check wire row. One table: a good value for each schema,
// then each refused field.
import { describe, it, expect } from 'vitest'
import type { z } from 'zod'
import {
  translationApproveInput,
  translationExportSheetInput,
  translationProposeInput,
  translationRestoreInput,
  translationSetInput,
  translationWriteInput,
} from '@/shared/schemas/commands/translation'
import { checkRunInput } from '@/shared/schemas/commands/check'
import { layerSetFontsInput } from '@/shared/schemas/commands/language-font'
import { CheckResult } from '@/shared/schemas/checks'
import { VariantCheckRow } from '@/shared/schemas/rows/variant-check'
import { translationForCampaignInput } from '@/shared/schemas/queries/translation'
import { checkResultsInput } from '@/shared/schemas/queries/check'
import { translationJobRequest, translationJobResult } from '@/shared/schemas/jobs/translation'
import { ROW_SCHEMAS } from '@/shared/schemas/rows'

const P = { projectId: 'P1' }
const ids = (n: number) => Array.from({ length: n }, (_, i) => `L${i}`)
const approved = (n: number) => ids(n).map((layerId) => ({ layerId, copyRev: 0 }))
const restoreItem = {
  layerId: 'L1',
  copy: 'Hallo',
  translationStatus: 'approved',
  translationSource: 'ai',
  syncedCopyRev: 2,
}
const result = {
  checkId: 'text-colours',
  group: 'brand-legal',
  status: 'warn',
  findings: [{ layerId: 'L1', message: 'Headline uses #FF0000, which is not in the palette.' }],
}
const request = {
  mode: 'write',
  directionId: 'D1',
  from: 'en',
  to: 'de',
  region: 'DE',
  audience: 'Families',
  items: [{ key: 'headline', text: 'Shop now', masterCopyRev: 3 }],
  targets: [{ layerId: 'L1', key: 'headline', copyRev: 1 }],
}

type Row = [string, z.ZodType, unknown]

const GOOD: Row[] = [
  ['propose by IDs', translationProposeInput, { ...P, provider: 'fake', variantIds: ['V1'] }],
  [
    'propose by direction and language',
    translationProposeInput,
    { ...P, provider: 'fake', directionId: 'D1', language: 'de' },
  ],
  [
    'propose in sync mode',
    translationProposeInput,
    { ...P, provider: 'fake', variantIds: ['V1'], mode: 'sync' },
  ],
  ['propose with 500 IDs', translationProposeInput, { ...P, provider: 'f', variantIds: ids(500) }],
  ['set', translationSetInput, { ...P, layerId: 'L1', text: '', applyToSameLanguage: false }],
  [
    'set 5000 characters',
    translationSetInput,
    { ...P, layerId: 'L1', text: 'a'.repeat(5000), applyToSameLanguage: true },
  ],
  ['approve', translationApproveInput, { ...P, layers: [{ layerId: 'L1', copyRev: 0 }] }],
  ['approve 2000', translationApproveInput, { ...P, layers: approved(2000) }],
  ['export', translationExportSheetInput, { ...P, campaignId: 'C1', filePath: '/a/b.csv' }],
  ['write', translationWriteInput, { ...P, jobId: 'J1', items: [{ key: 'k', text: 'Hallo' }] }],
  ['restore', translationRestoreInput, { ...P, scope: 'variant', items: [restoreItem] }],
  [
    'restore nulls',
    translationRestoreInput,
    {
      ...P,
      scope: 'variant',
      items: [{ ...restoreItem, copy: null, translationStatus: null, translationSource: null }],
    },
  ],
  ['check.run by campaign', checkRunInput, { ...P, campaignId: 'C1' }],
  ['check.run by IDs', checkRunInput, { ...P, variantIds: ids(1000) }],
  ['setFonts', layerSetFontsInput, { ...P, items: [{ layerId: 'L1', fontAssetId: 'A1' }] }],
  [
    'setFonts null font',
    layerSetFontsInput,
    { ...P, items: [{ layerId: 'L1', fontAssetId: null }] },
  ],
  ['forCampaign', translationForCampaignInput, { ...P, campaignId: 'C1' }],
  ['check.results by campaign', checkResultsInput, { ...P, campaignId: 'C1' }],
  ['check.results by IDs', checkResultsInput, { ...P, variantIds: ['V1'] }],
  ['job request', translationJobRequest, request],
  ['job request, sync', translationJobRequest, { ...request, mode: 'sync', targets: [] }],
  ['job result', translationJobResult, { items: [{ key: 'headline', text: 'Hallo' }], written: 1 }],
  ['a check result', CheckResult, result],
  [
    'a skipped result with no layer',
    CheckResult,
    { ...result, status: 'skipped', findings: [{ message: 'The palette is empty.' }] },
  ],
  [
    'a variant_check row',
    VariantCheckRow,
    { variantId: 'V1', checkedRev: 4, ranAt: 'x', ranBy: 'export', results: [result] },
  ],
]

const BAD: Row[] = [
  [
    'propose with both targets',
    translationProposeInput,
    { ...P, provider: 'f', variantIds: ['V1'], directionId: 'D1', language: 'de' },
  ],
  ['propose with neither target', translationProposeInput, { ...P, provider: 'f' }],
  [
    'propose with a direction, no language',
    translationProposeInput,
    { ...P, provider: 'f', directionId: 'D1' },
  ],
  [
    'propose with IDs and a language',
    translationProposeInput,
    { ...P, provider: 'f', variantIds: ['V1'], language: 'de' },
  ],
  ['propose with 501 IDs', translationProposeInput, { ...P, provider: 'f', variantIds: ids(501) }],
  ['propose with no ID', translationProposeInput, { ...P, provider: 'f', variantIds: [] }],
  ['propose with no provider', translationProposeInput, { ...P, variantIds: ['V1'] }],
  [
    'propose with an unknown mode',
    translationProposeInput,
    { ...P, provider: 'f', variantIds: ['V1'], mode: 'x' },
  ],
  [
    'propose with an unknown key',
    translationProposeInput,
    { ...P, provider: 'f', variantIds: ['V1'], extra: 1 },
  ],
  [
    'set over 5000',
    translationSetInput,
    { ...P, layerId: 'L1', text: 'a'.repeat(5001), applyToSameLanguage: false },
  ],
  ['set with no tick value', translationSetInput, { ...P, layerId: 'L1', text: 'a' }],
  [
    'set with a status',
    translationSetInput,
    { ...P, layerId: 'L1', text: 'a', applyToSameLanguage: false, status: 'approved' },
  ],
  ['approve with no layer', translationApproveInput, { ...P, layers: [] }],
  ['approve over 2000', translationApproveInput, { ...P, layers: approved(2001) }],
  ['approve with the old layerIds', translationApproveInput, { ...P, layerIds: ['L1'] }],
  [
    'approve with a negative counter',
    translationApproveInput,
    { ...P, layers: [{ layerId: 'L1', copyRev: -1 }] },
  ],
  [
    'approve with a fractional counter',
    translationApproveInput,
    { ...P, layers: [{ layerId: 'L1', copyRev: 1.5 }] },
  ],
  [
    'approve with an unknown key',
    translationApproveInput,
    { ...P, layers: [{ layerId: 'L1', copyRev: 0, status: 'approved' }] },
  ],
  ['export with no path', translationExportSheetInput, { ...P, campaignId: 'C1', filePath: '' }],
  [
    'write with an empty text',
    translationWriteInput,
    { ...P, jobId: 'J1', items: [{ key: 'k', text: '' }] },
  ],
  ['restore with no item', translationRestoreInput, { ...P, scope: 'variant', items: [] }],
  ['restore with no scope', translationRestoreInput, { ...P, items: [restoreItem] }],
  [
    'restore over 2000',
    translationRestoreInput,
    { ...P, scope: 'variant', items: Array(2001).fill(restoreItem) },
  ],
  [
    'restore with a bad status',
    translationRestoreInput,
    { ...P, scope: 'variant', items: [{ ...restoreItem, translationStatus: 'done' }] },
  ],
  ['check.run with both', checkRunInput, { ...P, campaignId: 'C1', variantIds: ['V1'] }],
  ['check.run with neither', checkRunInput, { ...P }],
  ['check.run over 1000', checkRunInput, { ...P, variantIds: ids(1001) }],
  ['check.results with both', checkResultsInput, { ...P, campaignId: 'C1', variantIds: ['V1'] }],
  ['setFonts with no item', layerSetFontsInput, { ...P, items: [] }],
  [
    'setFonts over 500',
    layerSetFontsInput,
    { ...P, items: Array(501).fill({ layerId: 'L1', fontAssetId: null }) },
  ],
  ['setFonts with no font field', layerSetFontsInput, { ...P, items: [{ layerId: 'L1' }] }],
  ['forCampaign with no campaign', translationForCampaignInput, { ...P }],
  ['job request with an unknown mode', translationJobRequest, { ...request, mode: 'x' }],
  ['a result with an unknown check', CheckResult, { ...result, checkId: 'spelling' }],
  [
    'a row run by someone else',
    VariantCheckRow,
    { variantId: 'V1', checkedRev: 0, ranAt: 'x', ranBy: 'system', results: [] },
  ],
]

describe('the Phase 6 schemas [P6-1]', () => {
  it.each(GOOD)('accepts %s', (_name, schema, value) => {
    expect(schema.safeParse(value).success).toBe(true)
  })

  it.each(BAD)('refuses %s', (_name, schema, value) => {
    expect(schema.safeParse(value).success).toBe(false)
  })

  it("defaults propose's mode to write", () => {
    const parsed = translationProposeInput.parse({ ...P, provider: 'f', variantIds: ['V1'] })
    expect(parsed.mode).toBe('write')
  })

  it('checks variant_check rows as every other table', () => {
    expect(ROW_SCHEMAS.variant_check).toBe(VariantCheckRow)
  })
})
