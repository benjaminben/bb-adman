// spec/screens-campaign.md, "The campaign grid and the variant tile": the marks' words come
// from one table, and a mark shows only when it is true.
import { describe, expect, it } from 'vitest'
import { badgeMarks, badgeWords } from '@/renderer/screens/campaign/variant-tile/badge-words'
import type { VariantBadges } from '@/shared/schemas/queries/campaign'

const NONE: VariantBadges = {
  jobRunning: false,
  resultUnseen: false,
  outOfDate: false,
  overflow: false,
  translationUnapproved: false,
  checkWarning: false,
  checkStale: false,
  missingFile: false,
}

const TABLE = [
  ['jobRunning', 'Running'],
  ['resultUnseen', 'New result'],
  ['overflow', 'Text does not fit'],
  ['missingFile', 'File missing'],
  ['translationUnapproved', 'Translation not approved'],
  ['outOfDate', 'Out of date'],
  ['checkWarning', 'Check warning'],
  ['checkStale', 'Not checked'],
] as const

describe('badgeWords [S2-16]', () => {
  it.each(TABLE)('gives "%s" the word "%s" when it alone is true', (key, word) => {
    expect(badgeWords({ ...NONE, [key]: true })).toEqual([word])
  })

  it('gives no word when no mark is true', () => {
    expect(badgeWords(NONE)).toEqual([])
  })

  it('gives every word in the table order when all are true', () => {
    const all = Object.fromEntries(Object.keys(NONE).map((k) => [k, true])) as VariantBadges
    expect(badgeWords(all)).toEqual(TABLE.map(([, word]) => word))
  })
})

// Design wave CAMP-1: each mark's kind is its StatusMark tone.
describe('badgeMarks tones [CAMP-1]', () => {
  it('gives each mark its tone, in the table order', () => {
    const all = Object.fromEntries(Object.keys(NONE).map((k) => [k, true])) as VariantBadges
    expect(badgeMarks(all).map((mark) => mark.kind)).toEqual([
      'running',
      'accent',
      'danger',
      'warn',
      'none',
      'warn',
      'warn',
      'none',
    ])
  })

  it('draws "New result" as a dot, with no icon', () => {
    expect(badgeMarks({ ...NONE, resultUnseen: true })[0]?.icon).toBeUndefined()
  })
})
