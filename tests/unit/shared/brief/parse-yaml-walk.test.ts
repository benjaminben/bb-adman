import { afterEach, describe, it, expect, vi } from 'vitest'
import { Document } from 'yaml'
import { parseBrief } from '../../../../src/shared/brief/parse'
import { BRIEF_UNREADABLE } from '../../../../src/shared/brief/draft'
import { MAX_BRIEF_ALIASES } from '../../../../src/shared/config/brief-limits'

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

// SPEC 6.1 item 7 [1.28]: two guards with one number. The library refuses growth through
// one anchor (it counts the anchor from 1); the walk refuses more than 100 alias nodes.
describe('parseBrief YAML: at most 100 aliases [SPEC 6.1 item 7]', () => {
  const withAliases = (ofA: number, ofB: number): string => {
    const aliases = [...Array<string>(ofA).fill('*a'), ...Array<string>(ofB).fill('*b')]
    return `campaignName: &a Summer\nregion: &b US\nextra: [${aliases.join(', ')}]\n`
  }
  const read = { ok: true, data: { campaignName: 'Summer', region: 'US' } }

  it('is 100', () => {
    expect(MAX_BRIEF_ALIASES).toBe(100)
  })

  it('reads 99 aliases of one anchor', () => {
    expect(parseBrief(withAliases(99, 0), 'yaml')).toEqual(read)
  })

  it('refuses 100 aliases of one anchor (the library guard)', () => {
    expect(parseBrief(withAliases(100, 0), 'yaml')).toEqual(unreadable)
  })

  it('reads 100 aliases shared between two anchors, 50 each', () => {
    expect(parseBrief(withAliases(50, 50), 'yaml')).toEqual(read)
  })

  it('refuses 101 aliases shared between two anchors (the walk guard)', () => {
    expect(parseBrief(withAliases(51, 50), 'yaml')).toEqual(unreadable)
  })

  it('refuses before the document becomes data', () => {
    const toJS = vi.spyOn(Document.prototype, 'toJS')
    expect(parseBrief(withAliases(51, 50), 'yaml')).toEqual(unreadable)
    expect(toJS).not.toHaveBeenCalled()
  })
})
