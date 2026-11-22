import { describe, it, expect } from 'vitest'
import { parseBriefText } from '@/shared/brief/text'

const UNREADABLE = {
  ok: false,
  error: {
    code: 'INVALID_INPUT',
    message: 'The brief could not be read as JSON, YAML or Markdown.',
    details: { reason: 'brief_unreadable' },
  },
}
const read = (draft: object, syntax: string): object => ({ ok: true, data: { draft, syntax } })

// Round 2 plan D1 [A-340, A-341].
describe('parseBriefText [D1]', () => {
  it.each([
    [
      'JSON',
      '{"region":"Canada","languages":["en"]}',
      read({ region: 'Canada', languages: ['en'] }, 'json'),
    ],
    ['JSON with no known field', '{"Region":"Canada"}', read({}, 'json')],
    [
      'YAML',
      'region: Canada\nlanguages: [en, fr]\n',
      read({ region: 'Canada', languages: ['en', 'fr'] }, 'yaml'),
    ],
    [
      'Markdown',
      '# Spring\n\n## Message\nHello',
      read({ campaignName: 'Spring', message: 'Hello' }, 'markdown'),
    ],
    [
      'YAML with no known key falls to Markdown',
      'Region: Canada',
      read({ region: 'Canada' }, 'markdown'),
    ],
    [
      'a YAML custom tag as plain text',
      'region: !js/function "return 1"\n',
      read({ region: 'return 1' }, 'yaml'),
    ],
    [
      'malformed YAML falls to Markdown',
      'Region: Canada\n## Message\nHi: [',
      read({ region: 'Canada', message: 'Hi: [' }, 'markdown'),
    ],
  ])('reads %s', (_name, text, expected) => {
    expect(parseBriefText(text)).toEqual(expected)
  })

  it.each([
    ['an empty text', ''],
    ['plain words', 'Just some words about a campaign.'],
    ['a JSON array', '[1, 2]'],
    ['a YAML alias bomb', 'a: &a [x]\nb: [*a, *a]\n'],
    ['a JSON brief of the wrong shape', '{"region": 5}x'],
  ])('gives the one D1 error for %s', (_name, text) => {
    expect(parseBriefText(text)).toEqual(UNREADABLE)
  })

  it('gives no line of the text in its error', () => {
    const result = parseBriefText('secret words: [')
    expect(JSON.stringify(result)).not.toContain('secret')
  })

  it.each([
    ['JSON', `${'['.repeat(10_000)}${']'.repeat(10_000)}`],
    ['JSON in a field', `{"languages":${'['.repeat(10_000)}${']'.repeat(10_000)}}`],
    ['YAML flow', `languages: ${'['.repeat(10_000)}${']'.repeat(10_000)}`],
    ['YAML block', Array.from({ length: 10_000 }, (_, i) => `${' '.repeat(i)}- x`).join('\n')],
    [
      'Markdown',
      `Languages:\n${Array.from({ length: 10_000 }, (_, i) => `${'  '.repeat(i % 50)}- x${i}`).join('\n')}`,
    ],
  ])('never throws on 10,000 nested lists (%s)', (_name, text) => {
    expect(() => parseBriefText(text)).not.toThrow()
    expect(parseBriefText(text)).toHaveProperty('ok')
  })
})
