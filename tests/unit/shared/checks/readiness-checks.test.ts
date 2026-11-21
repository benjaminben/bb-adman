import { describe, expect, it } from 'vitest'
import { textOverflowCheck, unapprovedTranslationsCheck } from '@/shared/checks/readiness-checks'
import type { CheckInput } from '@/shared/checks/types'
import { input, picture, text } from './fixtures'

type Row = [
  string,
  CheckInput,
  'pass' | 'warn' | 'skipped',
  Array<{ layerId?: string; message: string }>,
]

const french = (layers: CheckInput['layers']) => input({ layers, variant: { language: 'fr-FR' } })

describe('unapproved-translations [FR-116, R-18]', () => {
  it.each<Row>([
    [
      'skipped in the primary language',
      input({ layers: [text('t', 'Vexlo', { translationStatus: 'missing' })] }),
      'skipped',
      [{ message: 'This post is in the main language.' }],
    ],
    [
      'passes when every translation is approved',
      french([text('t', 'Vexlo', { translationStatus: 'approved' })]),
      'pass',
      [],
    ],
    [
      'warns for a proposed and a missing translation',
      french([
        text('t1', 'Vexlo', { name: 'Title', translationStatus: 'proposed' }),
        text('t2', null, { name: 'Tag', translationStatus: 'missing' }),
        picture('p', 'a1'),
      ]),
      'warn',
      [
        { layerId: 't1', message: 'Title: the translation is not approved.' },
        { layerId: 't2', message: 'Tag has no translation yet.' },
      ],
    ],
  ])('%s', (_label, value, status, findings) => {
    const result = unapprovedTranslationsCheck(value)
    expect(result).toMatchObject({ checkId: 'unapproved-translations', group: 'readiness', status })
    expect(result.findings).toEqual(findings)
  })
})

describe('text-overflow [FR-116, R-18]', () => {
  it.each<Row>([
    ['passes with no layers', input(), 'pass', []],
    ['passes when nothing overflows', input({ layers: [text('t', 'Vexlo')] }), 'pass', []],
    [
      'warns for a shown overflowing layer',
      input({ layers: [text('t', 'Vexlo', { name: 'Title', overflow: true })] }),
      'warn',
      [{ layerId: 't', message: 'Title does not fit its box.' }],
    ],
    [
      'passes for a hidden overflowing layer',
      input({ layers: [text('t', 'Vexlo', { overflow: true, visible: false })] }),
      'pass',
      [],
    ],
  ])('%s', (_label, value, status, findings) => {
    const result = textOverflowCheck(value)
    expect(result).toMatchObject({ checkId: 'text-overflow', group: 'readiness', status })
    expect(result.findings).toEqual(findings)
  })
})
