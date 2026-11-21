import { describe, it, expect } from 'vitest'
import { parseBrief } from '@/shared/brief/parse'
import { BRIEF_UNREADABLE } from '@/shared/brief/draft'
import { MAX_BRIEF_DEPTH } from '@/shared/config/brief-limits'

const unreadable = { ok: false, error: BRIEF_UNREADABLE }
const usOnly = { ok: true, data: { region: 'US' } }

// SPEC 6.1 item 9 rule 1 [1.31], 14 Q1, security class: the library's own tokens are checked
// before compose. Any directive but %YAML is refused, and so is nesting over MAX_BRIEF_DEPTH.
describe('parseBrief YAML: directives other than %YAML are refused [SPEC 6.1 item 9, 14 Q1]', () => {
  it('refuses a %TAG line', () => {
    expect(parseBrief('%TAG ! tag:example.com,2000:\n---\nregion: US\n', 'yaml')).toEqual(
      unreadable,
    )
  })

  it('refuses an unknown directive', () => {
    expect(parseBrief('%FOO bar\n---\nregion: US\n', 'yaml')).toEqual(unreadable)
  })

  it('refuses a %TAG line with two byte-order marks in front', () => {
    const text = '\uFEFF\uFEFF%TAG ! tag:example.com,2000:\n---\nregion: US\n'
    expect(parseBrief(text, 'yaml')).toEqual(unreadable)
  })

  it('reads a %YAML 1.2 line', () => {
    expect(parseBrief('%YAML 1.2\n---\nregion: US\n', 'yaml')).toEqual(usOnly)
  })

  it('reads a % line that is text inside a block', () => {
    const text = 'message: |\n  %TAG is text here\nregion: US\n'
    expect(parseBrief(text, 'yaml')).toEqual({
      ok: true,
      data: { message: '%TAG is text here\n', region: 'US' },
    })
  })
})

const lists = (n: number): string => `region: US\nextra: ${'['.repeat(n)}${']'.repeat(n)}\n`

describe('parseBrief YAML: at most 32 levels of nesting [SPEC 6.1 item 9, 14 Q1]', () => {
  it('is 32', () => {
    expect(MAX_BRIEF_DEPTH).toBe(32)
  })

  it('reads 8 nested lists under a top-level key', () => {
    expect(parseBrief(lists(8), 'yaml')).toEqual(usOnly)
  })

  it('refuses 100 nested lists under a key', () => {
    expect(parseBrief(lists(100), 'yaml')).toEqual(unreadable)
  })

  it('refuses 100 "- " on one line before a value', () => {
    expect(parseBrief(`region: US\nextra:\n  ${'- '.repeat(100)}x\n`, 'yaml')).toEqual(unreadable)
  })

  it('refuses 100 block maps inside each other', () => {
    const maps = Array.from({ length: 100 }, (_, i) => `${' '.repeat(i)}k${i}:`).join('\n')
    expect(parseBrief(`region: US\n${maps} 1\n`, 'yaml')).toEqual(unreadable)
  })

  // The edge, as measured: the top-level map is one level, so 32 nested lists under a key
  // are read and 33 are refused. Pinned so a later change shows.
  it('reads 32 nested lists under a key and refuses 33', () => {
    expect(parseBrief(lists(32), 'yaml')).toEqual(usOnly)
    expect(parseBrief(lists(33), 'yaml')).toEqual(unreadable)
  })

  // SPEC 6.1 item 9 [1.36] correction, 14 S4: a value inside the innermost list adds one
  // step to the path, so the edge moves down by one.
  it('reads 31 nested lists with a value inside and refuses 32', () => {
    const withValue = (n: number): string =>
      `region: US\nextra: ${'['.repeat(n)}x${']'.repeat(n)}\n`
    expect(parseBrief(withValue(31), 'yaml')).toEqual(usOnly)
    expect(parseBrief(withValue(32), 'yaml')).toEqual(unreadable)
  })
})

// SPEC 6.1 item 9 rule 2 [1.31], 14 Q2, security class: after compose, the walk refuses any
// alias, any anchor (also with no alias) and any key that is not a single value.
describe('parseBrief YAML: no anchors and no aliases [SPEC 6.1 item 9, 14 Q2]', () => {
  it.each([
    ['on a value', 'campaignName: &a Summer\n'],
    ['on a list', 'languages: &l [en]\n'],
    ['on a block map', 'copy: &c\n  en:\n    headline: A\n'],
    ['on a key', '&k region: US\n'],
  ])('refuses an anchor with no alias %s', (_, text) => {
    expect(parseBrief(text, 'yaml')).toEqual(unreadable)
  })

  it('refuses one alias', () => {
    expect(parseBrief('campaignName: &a Summer\nmessage: *a\n', 'yaml')).toEqual(unreadable)
  })

  it('reads & and * inside text, with the texts unchanged', () => {
    const text = 'message: Buy 1 & save *today*\ncallToAction: "*Terms apply & more"\n'
    expect(parseBrief(text, 'yaml')).toEqual({
      ok: true,
      data: { message: 'Buy 1 & save *today*', callToAction: '*Terms apply & more' },
    })
  })
})

describe('parseBrief YAML: every key is a single value [SPEC 6.1 item 9, 14 Q2]', () => {
  it.each([
    ['a list as a key, block form', '? [a, b]\n: c\nregion: US\n'],
    ['a list as a key, flow form', 'extra: {[a, b]: 1}\n'],
    ['a map as a key', '? {a: 1}\n: c\n'],
  ])('refuses %s', (_, text) => {
    expect(parseBrief(text, 'yaml')).toEqual(unreadable)
  })

  it('reads a quoted key', () => {
    expect(parseBrief('"region": US\n', 'yaml')).toEqual(usOnly)
  })

  it('reads a number key and an empty key', () => {
    expect(parseBrief('region: US\n1: a\n: c\n', 'yaml')).toEqual(usOnly)
  })
})
