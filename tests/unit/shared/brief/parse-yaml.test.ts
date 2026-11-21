import { afterEach, describe, it, expect, vi } from 'vitest'
import { parseBrief } from '../../../../src/shared/brief/parse'
import { BRIEF_UNREADABLE } from '../../../../src/shared/brief/draft'

const unreadable = { ok: false, error: BRIEF_UNREADABLE }

// SPEC 6.1 "Reading a brief file safely", item 3, and SPEC 14 N2: the YAML settings.
describe('parseBrief YAML: 1.2 core rules [SPEC 6.1]', () => {
  it('reads NO, unquoted ratios and no as text', () => {
    const text = 'region: NO\nsizes:\n  - 1:1\n  - 16:9\nlanguages: [no]\n'
    expect(parseBrief(text, 'yaml')).toEqual({
      ok: true,
      data: { region: 'NO', sizes: ['1:1', '16:9'], languages: ['no'] },
    })
  })

  it('refuses two documents in one file', () => {
    expect(parseBrief('region: US\n---\nregion: FR\n', 'yaml')).toEqual(unreadable)
  })

  it('refuses a key given twice', () => {
    expect(parseBrief('region: US\nregion: FR\n', 'yaml')).toEqual(unreadable)
  })

  it('does not merge a << key', () => {
    const text = '<<: {campaignName: Summer}\nregion: US\n'
    expect(parseBrief(text, 'yaml')).toEqual({ ok: true, data: { region: 'US' } })
  })
})

describe('parseBrief YAML: aliases [SPEC 6.1, 8.1]', () => {
  it('refuses a file built to grow through aliases, and finishes', () => {
    const lines = ['l0: &l0 [x, x, x, x, x, x, x, x, x]']
    for (let i = 1; i <= 9; i += 1) {
      lines.push(
        `l${i}: &l${i} [${Array<string>(9)
          .fill(`*l${i - 1}`)
          .join(', ')}]`,
      )
    }
    expect(parseBrief(lines.join('\n'), 'yaml')).toEqual(unreadable)
  })

  it('refuses one anchor used twice in a small file', () => {
    const text = 'campaignName: &name Summer\nmessage: *name\n'
    expect(parseBrief(text, 'yaml')).toEqual(unreadable)
  })
})

// Observed in yaml 2.9.1: an unknown tag is a warning, not an error, and the value is read
// as the plain data under the tag. The brief is read, with the tagged values as text.
describe('parseBrief YAML: tags give plain data only [SPEC 6.1]', () => {
  const tagged = [
    'campaignName: !!js/function "function () { return 1 }"',
    'message: !!binary aGVsbG8=',
    'tone: !thing warm',
    'offer: !!timestamp 2001-12-14',
    'subjects: !!set { a: null }',
    '',
  ].join('\n')

  it('reads tagged values as plain text and does not throw', () => {
    expect(parseBrief(tagged, 'yaml')).toEqual({
      ok: true,
      data: {
        campaignName: 'function () { return 1 }',
        message: 'aGVsbG8=',
        tone: 'warm',
        offer: '2001-12-14',
      },
    })
  })
})

describe('parseBrief YAML: nothing is printed [SPEC 6.1]', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([
    ['the tagged file', 'tone: !thing warm\n? [a, b]\n: c\n'],
    ['the broken file', 'campaignName: "Summer\nregion: [US\n'],
    ['a tagged file that is read', 'tone: !thing warm\n'],
  ])('writes no warning for %s', (_, text) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const emit = vi.spyOn(process, 'emitWarning').mockImplementation(() => undefined)
    parseBrief(text, 'yaml')
    expect(warn).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
    expect(emit).not.toHaveBeenCalled()
  })
})

// SPEC 14 P3 [1.26] (slice B review, F5): the options given in the call win over the
// directive, so the 1.2 core rules still hold.
describe('parseBrief YAML: a %YAML 1.1 line [SPEC 6.1, 14 P3]', () => {
  it('still reads NO and no as text', () => {
    const text = '%YAML 1.1\n---\nregion: NO\nlanguages: [no]\n'
    expect(parseBrief(text, 'yaml')).toEqual({
      ok: true,
      data: { region: 'NO', languages: ['no'] },
    })
  })
})
