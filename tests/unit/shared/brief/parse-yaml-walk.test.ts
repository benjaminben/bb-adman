import { afterEach, describe, it, expect, vi } from 'vitest'
import { Document } from 'yaml'
import { parseBrief } from '../../../../src/shared/brief/parse'
import { BRIEF_UNREADABLE } from '../../../../src/shared/brief/draft'

const unreadable = { ok: false, error: BRIEF_UNREADABLE }

afterEach(() => {
  vi.restoreAllMocks()
})

// SPEC 6.1 item 7 [1.26, 1.28], 14 P2: parseBrief finds repeated keys itself, in one walk,
// with the comparison the library made.
describe('parseBrief YAML: repeated keys, found in one walk [SPEC 6.1 item 7]', () => {
  it('refuses a key given twice in a nested mapping', () => {
    const text = 'copy:\n  en:\n    headline: A\n  fr:\n    headline: B\n  en:\n    headline: C\n'
    expect(parseBrief(text, 'yaml')).toEqual(unreadable)
  })

  it('refuses a key given twice in a flow mapping', () => {
    expect(parseBrief('copy: {a: 1, a: 2}\n', 'yaml')).toEqual(unreadable)
  })

  it('reads the same key in two different mappings', () => {
    const text = 'copy:\n  en:\n    headline: A\n  fr:\n    headline: B\n'
    expect(parseBrief(text, 'yaml')).toEqual({
      ok: true,
      data: { copy: { en: { headline: 'A' }, fr: { headline: 'B' } } },
    })
  })

  // The number 1 and the text "1" are different keys; the later one wins as data.
  it('reads the keys 1 and "1" in one mapping', () => {
    const text = 'copy:\n  1:\n    headline: A\n  "1":\n    headline: B\n'
    expect(parseBrief(text, 'yaml')).toEqual({
      ok: true,
      data: { copy: { '1': { headline: 'B' } } },
    })
  })

  // Checked on b037ca3 (the library's own check): NaN is never equal to itself.
  it('reads the key .nan given twice, as before this run', () => {
    expect(parseBrief('region: US\n.nan: 1\n.nan: 2\n', 'yaml')).toEqual({
      ok: true,
      data: { region: 'US' },
    })
  })
})

// SPEC 6.1 item 9 [1.31]: the walk refuses any anchor and any alias, before toJS.
describe('parseBrief YAML: no anchors, no aliases [SPEC 6.1 item 9]', () => {
  it('refuses before the document becomes data', () => {
    const toJS = vi.spyOn(Document.prototype, 'toJS')
    expect(parseBrief('campaignName: &a Summer\nmessage: *a\n', 'yaml')).toEqual(unreadable)
    expect(toJS).not.toHaveBeenCalled()
  })
})
