// P8-7 [FR-232, A-205]: each size and language pair of the campaign against what has a file.
import { describe, expect, it } from 'vitest'
import { missingPairs, type DeliveredInput } from '@/main/export/report/delivered'

const variants = [
  { variantId: 'sq-en', sizeLabel: '1x1', language: 'en' },
  { variantId: 'sq-en-2', sizeLabel: '1x1', language: 'en' },
  { variantId: 'sq-de', sizeLabel: '1x1', language: 'de' },
  { variantId: 'tall-en', sizeLabel: '9x16', language: 'en' },
]

const base: DeliveredInput = {
  sizeLabels: ['1x1', '9x16'],
  languages: ['en', 'de'],
  variants,
  chosen: ['sq-en', 'sq-de', 'tall-en'],
  withFile: ['sq-en', 'sq-de', 'tall-en'],
}

describe('missingPairs [FR-232]', () => {
  it.each([
    [
      'no_variant for a pair the campaign has no ad for',
      {},
      [{ sizeLabel: '9x16', language: 'de', reason: 'no_variant' }],
    ],
    [
      'not_in_export for a pair none of whose ads was chosen',
      { chosen: ['sq-en', 'tall-en'], withFile: ['sq-en', 'tall-en'] },
      [
        { sizeLabel: '1x1', language: 'de', reason: 'not_in_export' },
        { sizeLabel: '9x16', language: 'de', reason: 'no_variant' },
      ],
    ],
    [
      'export_failed when every chosen ad of the pair failed',
      { withFile: ['sq-en', 'sq-de'] },
      [
        { sizeLabel: '9x16', language: 'en', reason: 'export_failed' },
        { sizeLabel: '9x16', language: 'de', reason: 'no_variant' },
      ],
    ],
    [
      'nothing for a pair delivered by a second ad (another direction or format)',
      {
        chosen: ['sq-en', 'sq-en-2', 'sq-de', 'tall-en'],
        withFile: ['sq-en-2', 'sq-de', 'tall-en'],
      },
      [{ sizeLabel: '9x16', language: 'de', reason: 'no_variant' }],
    ],
  ])('gives %s', (_, over, expected) => {
    expect(missingPairs({ ...base, ...over })).toEqual(expected)
  })
})
