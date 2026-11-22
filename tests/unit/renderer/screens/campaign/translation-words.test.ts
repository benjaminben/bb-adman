// P6-12 (spec/phases/phase-06.md, design addition 8): the translation panel's words, groups and
// approve lists, worked out from translation.forCampaign's rows alone.
import { describe, expect, it } from 'vitest'
import {
  approvalOf,
  groupHeading,
  groupRows,
  languageName,
  markWords,
  rowLine,
  sourceLabel,
  sourceLine,
} from '@/renderer/screens/campaign/translation-panel/translation-words'
import { translationRow as row } from './translation-fixture'

describe('translation words [P6-12]', () => {
  it('gives each status its mark and each source its words', () => {
    const table: Array<[Parameters<typeof markWords>, ReturnType<typeof markWords>]> = [
      [['missing', null], { mark: 'Missing', from: null }],
      [['proposed', 'ai'], { mark: 'Proposed', from: 'from AI' }],
      [['proposed', 'agent'], { mark: 'Proposed', from: 'from an agent' }],
      [['proposed', 'user'], { mark: 'Proposed', from: 'from you' }],
      [['approved', 'brief'], { mark: 'Approved', from: 'from the brief' }],
      [[null, null], { mark: 'Missing', from: null }],
    ]
    for (const [input, words] of table) expect(markWords(...input)).toEqual(words)
  })

  it('shows the source text, or "No source text" when there is none', () => {
    expect(sourceLine('Fresh coffee')).toBe('Fresh coffee')
    expect(sourceLine(null)).toBe('No source text')
  })

  it('names a row by title, size and layer', () => {
    expect(
      rowLine(row('L1', { title: 'Morning', sizeLabel: 'Story', layerName: 'Headline' })),
    ).toBe('Morning · Story · Headline')
  })

  it('names a language in words, and falls back to its code', () => {
    expect(languageName('de')).toBe('German')
    expect(languageName('fr')).toBe('French')
    expect(languageName('not a code!')).toBe('not a code!')
  })

  it('counts the approved rows in the heading', () => {
    const rows = [
      row('L1', { status: 'approved' }),
      row('L2', { status: 'proposed' }),
      row('L3', { status: 'missing', source: null }),
    ]
    expect(groupHeading('de', rows)).toBe('German · 1 of 3 approved')
    expect(groupHeading('de', [])).toBe('German · 0 of 0 approved')
  })

  it('groups rows by language in the order they come, leaving out the primary language', () => {
    const rows = [
      row('L1', { language: 'de' }),
      row('L2', { language: 'fr' }),
      row('L3', { language: 'en' }),
      row('L4', { language: 'de' }),
    ]
    const groups = groupRows({ primaryLanguage: 'en', rows, jobs: [] })
    expect(groups.map((g) => [g.language, g.rows.map((r) => r.layerId)])).toEqual([
      ['de', ['L1', 'L4']],
      ['fr', ['L2']],
    ])
  })

  it('approves the proposed rows only, each with the copy counter it was read with', () => {
    const rows = [
      row('L1', { status: 'proposed', copyRev: 4 }),
      row('L2', { status: 'approved', copyRev: 2 }),
      row('L3', { status: 'missing', source: null, copyRev: 0 }),
      row('L4', { status: 'proposed', copyRev: 7 }),
    ]
    expect(approvalOf(rows)).toEqual([
      { layerId: 'L1', copyRev: 4 },
      { layerId: 'L4', copyRev: 7 },
    ])
  })

  it('labels the source text with its language [R2C-4]', () => {
    expect(sourceLabel('English')).toBe('English (source)')
  })
})
