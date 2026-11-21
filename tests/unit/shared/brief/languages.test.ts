import { describe, it, expect } from 'vitest'
import { isRightToLeft, primaryLanguageFor } from '@/shared/brief/languages'
import { REGION_LANGUAGES } from '@/shared/config/region-languages'

describe('isRightToLeft [SPEC 6.1, FR-104]', () => {
  it.each(['ar', 'he', 'fa', 'ur', 'yi', 'ps', 'sd', 'dv'])('is true for %s', (tag) => {
    expect(isRightToLeft(tag)).toBe(true)
  })

  it.each(['ar-EG', 'he-IL', 'fa-IR', 'AR', 'Ur-PK', ' ar '])(
    'reads the language part of %j, in any letter case',
    (tag) => {
      expect(isRightToLeft(tag)).toBe(true)
    },
  )

  it.each(['en', 'en-US', 'de', 'ja', 'arn', 'heb', 'ara', 'sd2', '', 'x-ar'])(
    'is false for %j',
    (tag) => {
      expect(isRightToLeft(tag)).toBe(false)
    },
  )
})

describe('primaryLanguageFor: the region table [SPEC 3.1, 6.1, FR-026]', () => {
  it.each([
    ['US', 'en'],
    ['GB', 'en'],
    ['DE', 'de'],
    ['FR', 'fr'],
    ['JP', 'ja'],
    ['BR', 'pt'],
    ['MX', 'es'],
  ])('looks up the ISO code %s', (region, language) => {
    expect(primaryLanguageFor(region)).toBe(language)
  })

  it.each([
    ['United States', 'en'],
    ['United Kingdom', 'en'],
    ['Germany', 'de'],
    ['Japan', 'ja'],
    ['South Korea', 'ko'],
  ])('looks up the country name %s', (region, language) => {
    expect(primaryLanguageFor(region)).toBe(language)
  })

  it('ignores letter case and spaces at both ends', () => {
    expect(primaryLanguageFor('us')).toBe('en')
    expect(primaryLanguageFor('  gErMaNy ')).toBe('de')
  })

  it.each(['Atlantis', '', '   ', 'U S', 'USA Inc', 'EU'])('gives null for %j', (region) => {
    expect(primaryLanguageFor(region)).toBeNull()
  })

  it('gives a right-to-left language where that is the main one; the refusal is elsewhere', () => {
    expect(primaryLanguageFor('Saudi Arabia')).toBe('ar')
    expect(primaryLanguageFor('IL')).toBe('he')
  })
})

describe('the region table itself [SPEC 3.1]', () => {
  it('has a two-letter capital ISO code, a name and a language tag on every row', () => {
    expect(REGION_LANGUAGES.length).toBeGreaterThan(0)
    for (const row of REGION_LANGUAGES) {
      expect(row.code).toMatch(/^[A-Z]{2}$/)
      expect(row.names.length).toBeGreaterThan(0)
      expect(row.language).toMatch(/^[a-z]{2,3}$/)
    }
  })

  it('names each region once, so a lookup has one answer', () => {
    const keys = REGION_LANGUAGES.flatMap((row) => [row.code, ...row.names]).map((key) =>
      key.toLowerCase(),
    )
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('answers every code and name in the table with that row’s language', () => {
    for (const row of REGION_LANGUAGES) {
      for (const key of [row.code, ...row.names]) {
        expect(primaryLanguageFor(key)).toBe(row.language)
      }
    }
  })
})

describe('isRightToLeft: an underscore also ends the language part [SPEC 6.1 1.26, 14 P6]', () => {
  it.each(['ar_SA', 'he_IL', 'AR_sa'])('%s is right-to-left', (tag) => {
    expect(isRightToLeft(tag)).toBe(true)
  })

  it.each(['en_US', 'x_ar'])('%s is not right-to-left', (tag) => {
    expect(isRightToLeft(tag)).toBe(false)
  })
})

describe('Macao is in the region table [P6-1, A-158]', () => {
  it.each(['MO', 'Macao', 'Macau'])('%s gives Chinese', (region) => {
    expect(primaryLanguageFor(region)).toBe('zh')
  })
})
