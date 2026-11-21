import { describe, it, expect } from 'vitest'
import { parseBrief } from '../../../../src/shared/brief/parse'
import { BRIEF_UNREADABLE } from '../../../../src/shared/brief/draft'
import type { BriefSyntax } from '../../../../src/shared/templates/types'

const unreadable = { ok: false, error: BRIEF_UNREADABLE }

const JSON_BRIEF = JSON.stringify({
  campaignName: 'Summer',
  region: 'US',
  message: 'Hello',
  subjects: [{ id: 'bottle', name: 'Bottle' }],
  sizes: ['1:1', '16:9'],
  copy: { en: { headline: 'Hi' } },
})
const YAML_BRIEF = [
  'campaignName: Summer',
  'region: US',
  'message: Hello',
  'subjects:',
  '  - id: bottle',
  '    name: Bottle',
  'sizes: ["1:1", "16:9"]',
  'copy:',
  '  en:',
  '    headline: Hi',
  '',
].join('\n')
const DRAFT = {
  campaignName: 'Summer',
  region: 'US',
  message: 'Hello',
  subjects: [{ id: 'bottle', name: 'Bottle' }],
  sizes: ['1:1', '16:9'],
  copy: { en: { headline: 'Hi' } },
}

// A brief of exactly `length` characters in the given syntax.
function padded(syntax: BriefSyntax, length: number): string {
  const head = syntax === 'json' ? '{"campaignName":"' : 'campaignName: '
  const tail = syntax === 'json' ? '"}' : ''
  return head + 'a'.repeat(length - head.length - tail.length) + tail
}

describe('parseBrief: a valid brief [SPEC 6.1, 14 N2]', () => {
  it('gives the same draft from JSON and from YAML', () => {
    expect(parseBrief(JSON_BRIEF, 'json')).toEqual({ ok: true, data: DRAFT })
    expect(parseBrief(YAML_BRIEF, 'yaml')).toEqual({ ok: true, data: DRAFT })
  })

  it.each([
    ['json', JSON_BRIEF],
    ['yaml', YAML_BRIEF],
  ] as const)('ignores a byte-order mark at the start (%s)', (syntax, text) => {
    expect(parseBrief(`\uFEFF${text}`, syntax)).toEqual({ ok: true, data: DRAFT })
  })

  it('does not try the other syntax when one fails', () => {
    expect(parseBrief(YAML_BRIEF, 'json')).toEqual(unreadable)
  })
})

describe('parseBrief: text that is not a brief gives brief_unreadable [SPEC 4.1]', () => {
  it.each([
    ['json', ''],
    ['json', '[1, 2]'],
    ['json', '"Summer"'],
    ['json', '7'],
    ['json', 'null'],
    ['yaml', ''],
    ['yaml', '- 1\n- 2\n'],
    ['yaml', 'Summer\n'],
    ['yaml', '7\n'],
    ['yaml', 'null\n'],
  ] as const)('%s: %j', (syntax, text) => {
    expect(parseBrief(text, syntax)).toEqual(unreadable)
  })

  it.each([
    ['json', '{"campaignName": "Zebracorn", '],
    ['yaml', 'campaignName: "Zebracorn\nregion: [US\n'],
  ] as const)('broken %s gives the fixed error, holding no word of the file', (syntax, text) => {
    const result = parseBrief(text, syntax)
    expect(result).toEqual(unreadable)
    expect(JSON.stringify(result)).not.toContain('Zebracorn')
  })

  it.each(['json', 'yaml'] as const)('5,000 nested lists give brief_unreadable (%s)', (syntax) => {
    const text = '['.repeat(5_000) + ']'.repeat(5_000)
    expect(parseBrief(text, syntax)).toEqual(unreadable)
  })
})

// SPEC 14 1.39 Z7: a brief has no size limit.
describe('parseBrief: a brief has no size limit [SPEC 14 1.39 Z7]', () => {
  it.each(['json', 'yaml'] as const)('reads a valid brief of 100,000 bytes (%s)', (syntax) => {
    const text = padded(syntax, 100_000)
    expect(new TextEncoder().encode(text).length).toBe(100_000)
    const result = parseBrief(text, syntax)
    expect(result.ok && result.data.campaignName?.length).toBeGreaterThan(99_000)
  })
})

describe('parseBrief: __proto__ keys change no prototype [SPEC 6.1, 8.1]', () => {
  const json = '{"__proto__": {"polluted": "yes"}, "copy": {"__proto__": {"polluted": "yes"}}}'
  const yaml = '__proto__:\n  polluted: yes\ncopy:\n  __proto__:\n    polluted: yes\n'

  it.each([
    ['json', json],
    ['yaml', yaml],
  ] as const)('%s', (syntax, text) => {
    const result = parseBrief(text, syntax)
    expect(result.ok).toBe(true)
    expect(Object.prototype).not.toHaveProperty('polluted')
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined()
    expect(Object.keys(Object.prototype)).toEqual([])
  })
})

// SPEC 14 P3 [1.26] (slice B review, F5), 6.1 item 9 [1.31]. The depth rule (at most
// MAX_BRIEF_DEPTH levels, checked on the tokens before compose) refuses the YAML file;
// JSON.parse reads it and the BriefDraft schema drops the copy field.
describe('parseBrief: 5,000 nested lists under a key [SPEC 6.1, 14 P3]', () => {
  const deep = '['.repeat(5_000) + ']'.repeat(5_000)

  it('gives brief_unreadable in YAML', () => {
    expect(parseBrief(`region: US\ncopy: ${deep}\n`, 'yaml')).toEqual(unreadable)
  })

  it('gives a draft with no copy in JSON', () => {
    expect(parseBrief(`{"region":"US","copy":${deep}}`, 'json')).toEqual({
      ok: true,
      data: { region: 'US' },
    })
  })
})
