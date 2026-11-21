import { describe, expect, it } from 'vitest'
import { prohibitedWordsCheck, requiredWordsCheck } from '@/shared/checks/word-checks'
import type { CheckInput } from '@/shared/checks/types'
import { input, text } from './fixtures'

type Row = [
  string,
  CheckInput,
  'pass' | 'warn' | 'skipped',
  Array<{ layerId?: string; message: string }>,
]

const banned = (
  layers: CheckInput['layers'],
  words: Record<string, string[]>,
  language = 'en-GB',
) => input({ layers, variant: { language }, ruleSet: { prohibitedWords: words } })

describe('prohibited-words [FR-113, FR-240]', () => {
  it.each<Row>([
    [
      'skipped with no list',
      banned([], {}),
      'skipped',
      [{ message: 'There are no prohibited words for en-GB.' }],
    ],
    [
      'skipped with a list for another language only',
      banned([], { 'fr-FR': ['zib'] }),
      'skipped',
      [{ message: 'There are no prohibited words for en-GB.' }],
    ],
    [
      'skipped with only blank entries',
      banned([], { 'en-GB': ['  '] }),
      'skipped',
      [{ message: 'There are no prohibited words for en-GB.' }],
    ],
    [
      'passes when no layer has the word',
      banned([text('t', 'Quiet glorp')], { 'en-GB': ['zib'] }),
      'pass',
      [],
    ],
    [
      'warns per layer and entry, a hidden layer included',
      banned(
        [
          text('t1', 'Zib and quor', { name: 'Title' }),
          text('t2', 'zib!', { name: 'Tag', visible: false }),
        ],
        { 'en-GB': [' zib ', 'quor'] },
      ),
      'warn',
      [
        { layerId: 't1', message: 'Title contains “zib”.' },
        { layerId: 't1', message: 'Title contains “quor”.' },
        { layerId: 't2', message: 'Tag contains “zib”.' },
      ],
    ],
    [
      'ignores a word inside a longer word',
      banned([text('t', 'Zibber')], { 'en-GB': ['zib'] }),
      'pass',
      [],
    ],
    [
      'matches a Japanese substring',
      banned(
        [text('t', 'きょうはセールです', { name: 'Title' })],
        { 'ja-JP': ['セール'] },
        'ja-JP',
      ),
      'warn',
      [{ layerId: 't', message: 'Title contains “セール”.' }],
    ],
  ])('%s', (_label, value, status, findings) => {
    const result = prohibitedWordsCheck(value)
    expect(result).toMatchObject({ checkId: 'prohibited-words', group: 'brand-legal', status })
    expect(result.findings).toEqual(findings)
  })
})

const wanted = (
  layers: CheckInput['layers'],
  words: Record<string, string[]>,
  language = 'en-GB',
) => input({ layers, variant: { language }, ruleSet: { requiredWords: words } })

describe('required-words [FR-113]', () => {
  it.each<Row>([
    [
      'skipped with no list',
      wanted([], {}),
      'skipped',
      [{ message: 'There are no required words for en-GB.' }],
    ],
    [
      'passes when the word is shown',
      wanted([text('t', 'Plim offer')], { 'en-GB': ['plim'] }),
      'pass',
      [],
    ],
    [
      'passes with entries spread over two layers',
      wanted([text('t1', 'Plim'), text('t2', 'Drav terms')], { 'en-GB': ['plim', 'drav terms'] }),
      'pass',
      [],
    ],
    [
      'a phrase does not match across a line break between layers',
      wanted([text('t1', 'Drav'), text('t2', 'terms')], { 'en-GB': ['drav terms'] }),
      'warn',
      [{ message: "“drav terms” is not in this post's text." }],
    ],
    [
      'a hidden layer does not count',
      wanted([text('t', 'Plim', { visible: false })], { 'en-GB': ['plim'] }),
      'warn',
      [{ message: "“plim” is not in this post's text." }],
    ],
    [
      'matches a Chinese substring',
      wanted([text('t', '今天大减价活动')], { 'zh-CN': ['减价', '免费'] }, 'zh-CN'),
      'warn',
      [{ message: "“免费” is not in this post's text." }],
    ],
  ])('%s', (_label, value, status, findings) => {
    const result = requiredWordsCheck(value)
    expect(result).toMatchObject({ checkId: 'required-words', group: 'brand-legal', status })
    expect(result.findings).toEqual(findings)
  })
})
