import { describe, it, expect } from 'vitest'
import { parseBrief, BRIEF_TOO_LARGE } from '../../../../src/shared/brief/parse'
import { BRIEF_UNREADABLE } from '../../../../src/shared/brief/draft'
import { MAX_BRIEF_BYTES } from '../../../../src/shared/config/brief-limits'
import type { BriefSyntax } from '../../../../src/shared/templates/types'

const unreadable = { ok: false, error: BRIEF_UNREADABLE }
const tooLarge = { ok: false, error: BRIEF_TOO_LARGE }

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

  it.each(['json', 'yaml'] as const)('10,000 nested lists give brief_unreadable (%s)', (syntax) => {
    const text = '['.repeat(10_000) + ']'.repeat(10_000)
    expect(parseBrief(text, syntax)).toEqual(unreadable)
  })
})

describe('parseBrief: the size limit [SPEC 6.1, 4.1 brief_too_large]', () => {
  it('is 64 KiB', () => {
    expect(MAX_BRIEF_BYTES).toBe(65_536)
  })

  it('has the message of Section 4.1', () => {
    expect(BRIEF_TOO_LARGE).toEqual({
      code: 'INVALID_INPUT',
      message: 'The brief is too large. The limit is 64 KB.',
      details: { reason: 'brief_too_large' },
    })
  })

  it.each(['json', 'yaml'] as const)('refuses one character over the limit (%s)', (syntax) => {
    expect(parseBrief(padded(syntax, MAX_BRIEF_BYTES + 1), syntax)).toEqual(tooLarge)
  })

  it.each(['json', 'yaml'] as const)('parses text exactly at the limit (%s)', (syntax) => {
    const text = padded(syntax, MAX_BRIEF_BYTES)
    expect(text.length).toBe(MAX_BRIEF_BYTES)
    const result = parseBrief(text, syntax)
    expect(result.ok && result.data.campaignName?.length).toBeGreaterThan(60_000)
  })

  it('checks the size before parsing, so broken text over the limit is too large', () => {
    expect(parseBrief('{'.repeat(MAX_BRIEF_BYTES + 1), 'json')).toEqual(tooLarge)
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

// A brief of exactly `bytes` UTF-8 bytes, filled with the three-byte character "€".
function paddedBytes(syntax: BriefSyntax, bytes: number): string {
  const head = syntax === 'json' ? '{"campaignName":"' : 'campaignName: '
  const tail = syntax === 'json' ? '"}' : ''
  const room = bytes - head.length - tail.length
  return head + '€'.repeat(Math.floor(room / 3)) + 'a'.repeat(room % 3) + tail
}

const byteCount = (text: string): number => new TextEncoder().encode(text).length

describe('parseBrief: the limit is counted in UTF-8 bytes [SPEC 6.1 item 7, 14 P1]', () => {
  it.each(['json', 'yaml'] as const)(
    'refuses text under the limit in characters but over it in bytes (%s)',
    (syntax) => {
      const text = paddedBytes(syntax, MAX_BRIEF_BYTES + 1)
      expect(text.length).toBeLessThan(MAX_BRIEF_BYTES)
      expect(byteCount(text)).toBe(MAX_BRIEF_BYTES + 1)
      expect(parseBrief(text, syntax)).toEqual(tooLarge)
    },
  )

  it.each(['json', 'yaml'] as const)(
    'parses three-byte text exactly at the limit in bytes (%s)',
    (syntax) => {
      const text = paddedBytes(syntax, MAX_BRIEF_BYTES)
      expect(byteCount(text)).toBe(MAX_BRIEF_BYTES)
      const result = parseBrief(text, syntax)
      expect(result.ok && result.data.campaignName?.startsWith('€€€')).toBe(true)
    },
  )

  it('counts a byte-order mark as three bytes', () => {
    const text = '﻿' + paddedBytes('json', MAX_BRIEF_BYTES - 2)
    expect(byteCount(text)).toBe(MAX_BRIEF_BYTES + 1)
    expect(parseBrief(text, 'json')).toEqual(tooLarge)
  })
})
