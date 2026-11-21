// P6-6 (spec/phases/phase-06.md, design addition 2, "Brief-supplied copy"; A-163): the brief's
// own copy for a language and slot, trimmed; empty or absent gives null.
import { describe, it, expect } from 'vitest'
import { briefCopyFor } from '@/shared/translation/brief-copy'
import type { Brief } from '@/shared/schemas/brief'

const BRIEF: Brief = {
  campaignName: 'Trail Days',
  region: 'DE',
  audience: 'Hikers',
  message: 'Go further',
  subjects: [{ name: 'Boot' }],
  copy: {
    de: { headline: '  Weiter gehen  ', callToAction: 'Jetzt kaufen' },
    fr: { headline: '   ' },
  },
}

describe('briefCopyFor [A-163]', () => {
  it.each([
    ['the headline, trimmed', BRIEF, 'de', 'headline', 'Weiter gehen'],
    ['the call to action', BRIEF, 'de', 'call-to-action', 'Jetzt kaufen'],
    ['null for a blank headline', BRIEF, 'fr', 'headline', null],
    ['null for an absent call to action', BRIEF, 'fr', 'call-to-action', null],
    ['null for a language the brief has no copy for', BRIEF, 'ja', 'headline', null],
    ['null for another slot', BRIEF, 'de', 'subhead', null],
    ['null for no slot', BRIEF, 'de', null, null],
    ['null for a brief without copy', { ...BRIEF, copy: undefined }, 'de', 'headline', null],
    ['null for a language named like an object key', BRIEF, 'constructor', 'headline', null],
    ['null for __proto__', BRIEF, '__proto__', 'headline', null],
  ] as const)('gives %s', (_name, brief, language, slot, expected) => {
    expect(briefCopyFor(brief, language, slot)).toBe(expected)
  })
})
