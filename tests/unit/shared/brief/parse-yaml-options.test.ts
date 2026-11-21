import { describe, it, expect, vi } from 'vitest'
import * as yaml from 'yaml'
import { parseBrief } from '@/shared/brief/parse'
import { BRIEF_UNREADABLE } from '@/shared/brief/draft'
import { tenLevelKey } from './slow-named'

// SPEC 6.1 item 3: the settings hold "whatever the library's defaults are", so they are set
// in the call. The real library still runs; the spy only records what it is given.
vi.mock('yaml', async (importOriginal) => {
  const real = await importOriginal<typeof import('yaml')>()
  return { ...real, parseDocument: vi.fn(real.parseDocument) }
})

describe('parseBrief YAML: the settings are given in the call [SPEC 6.1]', () => {
  it('passes 1.2 core rules, no custom tags, no merge keys, no library key check, no pretty errors, no printing', () => {
    parseBrief('region: US\n', 'yaml')
    expect(vi.mocked(yaml.parseDocument)).toHaveBeenCalledWith('region: US\n', {
      version: '1.2',
      schema: 'core',
      customTags: [],
      resolveKnownTags: false,
      merge: false,
      uniqueKeys: false,
      prettyErrors: false,
      logLevel: 'error',
    })
  })

  it('turns alias reading off when turning the document into data, with no reviver', () => {
    const toJS = vi.spyOn(yaml.Document.prototype, 'toJS')
    parseBrief('region: US\n', 'yaml')
    expect(toJS).toHaveBeenCalledWith({ maxAliasCount: 0 })
  })
})

// SPEC 6.1 item 9 rule 1 [1.31], 14 Q1: the token check refuses before compose.
describe('parseBrief YAML: the token check runs before compose [SPEC 6.1 item 9, 14 Q1]', () => {
  it.each([
    ['a %TAG file', '%TAG ! tag:example.com,2000:\n---\nregion: US\n'],
    ['a file 100 lists deep', `extra: ${'['.repeat(100)}${']'.repeat(100)}\n`],
  ])('does not compose %s', (_, text) => {
    vi.mocked(yaml.parseDocument).mockClear()
    expect(parseBrief(text, 'yaml')).toEqual({ ok: false, error: BRIEF_UNREADABLE })
    expect(vi.mocked(yaml.parseDocument)).not.toHaveBeenCalled()
  })
})

// SPEC 14 R3 [1.33], security class: the small form of named case 12 composes with no error,
// so the walk is what refuses it.
describe('parseBrief YAML: keys 10 lists deep reach the walk [SPEC 6.1 item 9, 14 R3]', () => {
  it('composes the small form of case 12 with no errors and still refuses it', () => {
    vi.mocked(yaml.parseDocument).mockClear()
    const text = `extra: [${Array<string>(3).fill(tenLevelKey).join(',')}]\n`
    expect(parseBrief(text, 'yaml')).toEqual({ ok: false, error: BRIEF_UNREADABLE })
    expect(vi.mocked(yaml.parseDocument)).toHaveBeenCalledOnce()
    const doc = vi.mocked(yaml.parseDocument).mock.results[0]?.value as yaml.Document
    expect(doc.errors).toEqual([])
  })
})
