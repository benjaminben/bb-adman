import { describe, it, expect, vi } from 'vitest'
import * as yaml from 'yaml'
import { parseBrief } from '../../../../src/shared/brief/parse'

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

  it('limits aliases to 100 when turning the document into data, with no reviver', () => {
    const toJS = vi.spyOn(yaml.Document.prototype, 'toJS')
    parseBrief('region: US\n', 'yaml')
    expect(toJS).toHaveBeenCalledWith({ maxAliasCount: 100 })
  })
})

// SPEC 6.1 item 9 rule 1 [1.31], 14 Q1: the token check refuses before compose.
describe('parseBrief YAML: the token check runs before compose [SPEC 6.1 item 9, 14 Q1]', () => {
  it.each([
    ['a %TAG file', '%TAG ! tag:example.com,2000:\n---\nregion: US\n'],
    ['a file 100 lists deep', `extra: ${'['.repeat(100)}${']'.repeat(100)}\n`],
  ])('does not compose %s', (_, text) => {
    vi.mocked(yaml.parseDocument).mockClear()
    expect(parseBrief(text, 'yaml')).toMatchObject({ ok: false })
    expect(vi.mocked(yaml.parseDocument)).not.toHaveBeenCalled()
  })
})
