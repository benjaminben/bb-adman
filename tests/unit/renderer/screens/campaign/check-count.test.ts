// R2C-1 (spec/phases/round-2-campaign.md, design addition 1, R-8, A-302): the Checks tab's
// badge counts the warned check results of every variant whose stored check is current.
import { describe, expect, it } from 'vitest'
import { warningCount } from '@/renderer/screens/campaign/campaign-overview/check-count'
import type { CheckResult } from '@/shared/schemas/checks'
import type { VariantCheckState } from '@/shared/schemas/queries/check'

const result = (checkId: CheckResult['checkId'], status: CheckResult['status']): CheckResult => ({
  checkId,
  group: 'brand-legal',
  status,
  findings: [],
})

const state = (variantId: string, results: CheckResult[], stale = false): VariantCheckState => ({
  variantId,
  rev: stale ? 3 : 2,
  checkedRev: 2,
  stale,
  ranAt: '2026-11-21T00:00:00.000Z',
  ranBy: 'user',
  results,
})

const warn = (id: CheckResult['checkId']) => result(id, 'warn')

describe('warningCount [R2C-1, A-302]', () => {
  it.each<[string, VariantCheckState[], number]>([
    ['no states', [], 0],
    ['one warned check', [state('V1', [warn('text-colours')])], 1],
    [
      'two warned checks on one variant',
      [state('V1', [warn('text-colours'), warn('prohibited-words')])],
      2,
    ],
    [
      'warnings across variants',
      [
        state('V1', [warn('text-colours')]),
        state('V2', [warn('text-colours'), warn('prohibited-words')]),
      ],
      3,
    ],
    [
      'a stale variant left out',
      [state('V1', [warn('text-colours')]), state('V2', [warn('text-colours')], true)],
      1,
    ],
    [
      'pass and skipped not counted',
      [
        state('V1', [
          result('text-colours', 'pass'),
          result('prohibited-words', 'skipped'),
          warn('required-words'),
        ]),
      ],
      1,
    ],
  ])('%s', (_name, states, count) => {
    expect(warningCount(states)).toBe(count)
  })
})
