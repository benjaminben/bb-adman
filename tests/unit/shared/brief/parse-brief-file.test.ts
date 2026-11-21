import { describe, it, expect } from 'vitest'
import { parseBrief, parseBriefFile } from '../../../../src/shared/brief/parse'
import { BRIEF_UNREADABLE } from '../../../../src/shared/brief/draft'

const lineThree = 'region: US\nname: ok\nkey: value: other\n'
const unreadable = { ok: false, error: BRIEF_UNREADABLE }

// SPEC 14 1.39 "The YAML message" (security class), Z3 [FR-297].
describe('parseBriefFile: a malformed YAML brief names its first bad line [SPEC 14 1.39 Z3]', () => {
  it('gives line 3 and its text for a fault on line 3', () => {
    expect(parseBriefFile(lineThree, 'yaml')).toEqual({
      ok: false,
      error: {
        code: 'INVALID_INPUT',
        message:
          'The brief is malformed. The first line that could not be read is line 3: key: value: other',
        details: { reason: 'brief_unreadable', line: 3, lineText: 'key: value: other' },
      },
    })
  })

  it('counts lines after a byte-order mark is removed', () => {
    const result = parseBriefFile(String.fromCharCode(0xfeff) + lineThree, 'yaml')
    expect(result.ok ? null : result.error.details).toEqual({
      reason: 'brief_unreadable',
      line: 3,
      lineText: 'key: value: other',
    })
  })

  it('holds nothing of the file but the bad line', () => {
    const text = 'name: MarkerWordZq\nregion: US\na: 1\nb: 2\nkey: value: other\n'
    const result = parseBriefFile(text, 'yaml')
    expect(result.ok ? null : result.error.details).toMatchObject({ line: 5 })
    expect(JSON.stringify(result)).not.toContain('MarkerWordZq')
  })

  it('gives "line {n}." when the cleaned line is empty', () => {
    const result = parseBriefFile('region: US\nname: "open\n', 'yaml')
    expect(result.ok).toBe(false)
    if (result.ok) return
    const { line } = result.error.details as { line: number }
    expect(result.error.message).toBe(
      `The brief is malformed. The first line that could not be read is line ${line}.`,
    )
    expect(result.error.details).toEqual({ reason: 'brief_unreadable', line, lineText: '' })
  })

  it('gives no line for a file with an anchor', () => {
    expect(parseBriefFile('region: &r US\nname: x\n', 'yaml')).toEqual(unreadable)
  })

  it('gives no line for a file with a %TAG line', () => {
    expect(parseBriefFile('%TAG ! tag:example.com,2000:\n---\nregion: US\n', 'yaml')).toEqual(
      unreadable,
    )
  })

  it('gives no line for a broken JSON file', () => {
    expect(parseBriefFile('{"region": "US",\n"name": }', 'json')).toEqual(unreadable)
  })

  it('gives no line for a YAML file that is not a map at the top', () => {
    expect(parseBriefFile('- one\n- two\n', 'yaml')).toEqual(unreadable)
  })

  it('reads a valid brief as parseBrief does', () => {
    expect(parseBriefFile('region: US\n', 'yaml')).toEqual({ ok: true, data: { region: 'US' } })
  })
})

describe('parseBrief keeps the fixed error [SPEC 14 1.39 The YAML message]', () => {
  it('gives BRIEF_UNREADABLE for the line-3 file', () => {
    expect(parseBrief(lineThree, 'yaml')).toEqual({ ok: false, error: BRIEF_UNREADABLE })
  })
})
