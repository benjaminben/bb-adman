// P6-11 (spec/phases/phase-06.md, design addition 8): the check panel's words. Check names,
// status words, the row label and the summary counts (CAMP-4: the block heading became the row
// label "{size} · {language}", the summary line the two marks' counts).
import { describe, expect, it } from 'vitest'
import {
  checkName,
  rowLabel,
  staleCount,
  statusWord,
} from '@/renderer/screens/campaign/check-panel/check-words'
import type { CheckId, CheckResult, CheckStatus } from '@/shared/schemas/checks'
import type { VariantCheckState } from '@/shared/schemas/queries/check'
import { variant } from './campaign-fixture'

describe('checkName [P6-11]', () => {
  it.each<[CheckId, string]>([
    ['required-assets', 'Required files'],
    ['text-colours', 'Text colours'],
    ['prohibited-words', 'Prohibited words'],
    ['required-words', 'Required words'],
    ['unapproved-translations', 'Translations approved'],
    ['text-overflow', 'Text fits'],
  ])('%s is called "%s"', (id, name) => {
    expect(checkName(id)).toBe(name)
  })
})

describe('statusWord [P6-11]', () => {
  it.each<[CheckStatus, string]>([
    ['pass', 'Passed'],
    ['warn', 'Warning'],
    ['skipped', 'Skipped'],
  ])('%s reads "%s"', (status, word) => {
    expect(statusWord(status)).toBe(word)
  })
})

describe('rowLabel [P6-11, CAMP-4]', () => {
  it('reads "{size} · {language}"', () => {
    const v = variant('V9', { title: 'Wide post', sizeLabel: '16:9', language: 'de' })
    expect(rowLabel(v)).toBe('16:9 · de')
  })
})

function result(checkId: CheckId, status: CheckStatus, group: CheckResult['group']): CheckResult {
  return { checkId, group, status, findings: [] }
}

function state(id: string, opts: { stale?: boolean; results?: CheckResult[] } = {}) {
  const s: VariantCheckState = {
    variantId: id,
    rev: opts.stale ? 2 : 1,
    checkedRev: 1,
    stale: opts.stale ?? false,
    ranAt: '2026-11-21T00:00:00.000Z',
    ranBy: 'user',
    results: opts.results ?? [result('text-colours', 'pass', 'brand-legal')],
  }
  return s
}

const BRAND_WARN = [result('prohibited-words', 'warn', 'brand-legal')]

describe('staleCount [P6-11, CAMP-4]', () => {
  it.each<[string, VariantCheckState[], number]>([
    ['nothing checked', [], 0],
    ['one post, all passed', [state('A')], 0],
    [
      'a stale post counts as not checked',
      [
        state('A', { stale: true, results: BRAND_WARN }),
        state('B'),
        state('C', { results: BRAND_WARN }),
      ],
      1,
    ],
  ])('%s', (_name, states, count) => {
    expect(staleCount(states)).toBe(count)
  })
})
