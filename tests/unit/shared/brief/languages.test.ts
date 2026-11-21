import { describe, it, expect } from 'vitest'
import { isRightToLeft } from '../../../../src/shared/brief/languages'

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
