// P6-11 (spec/phases/phase-06.md, design addition 8): the check panel's words. Check names,
// status words, the block heading and the summary line.
import { describe, expect, it } from 'vitest'
import {
  blockHeading,
  checkName,
  statusWord,
  summaryLine,
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

describe('blockHeading [P6-11]', () => {
  it('reads "{title} · {size} · {language}"', () => {
    const v = variant('V9', { title: 'Wide post', width: 1920, height: 1080, language: 'de' })
    expect(blockHeading(v)).toBe('Wide post · 1920×1080 · de')
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
const READY_WARN = [result('text-overflow', 'warn', 'readiness')]

describe('summaryLine [P6-11]', () => {
  it.each<[string, VariantCheckState[], string]>([
    [
      'nothing checked',
      [],
      '0 posts checked · 0 with brand or legal warnings · 0 not checked since a change',
    ],
    [
      'one post, all passed',
      [state('A')],
      '1 post checked · 0 with brand or legal warnings · 0 not checked since a change',
    ],
    [
      'a brand warning counts, a readiness warning does not',
      [state('A', { results: BRAND_WARN }), state('B', { results: READY_WARN })],
      '2 posts checked · 1 with brand or legal warnings · 0 not checked since a change',
    ],
    [
      'a stale post counts as not checked, not as a warning',
      [
        state('A', { stale: true, results: BRAND_WARN }),
        state('B'),
        state('C', { results: BRAND_WARN }),
      ],
      '3 posts checked · 1 with brand or legal warnings · 1 not checked since a change',
    ],
  ])('%s', (_name, states, line) => {
    expect(summaryLine(states)).toBe(line)
  })
})
