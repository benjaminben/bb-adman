import { describe, it, expect } from 'vitest'
import {
  MAX_PICTURE_BYTES,
  MAX_PICTURE_PIXELS,
  MAX_PICTURE_SIDE,
  MAX_PROVIDER_ANSWER_BYTES,
} from '../../../../src/main/providers/picture-limits'

describe('picture limits, one owner [SPEC 6.2 1.20, 14 L1]', () => {
  it('holds the four values of the Section 6.2 table', () => {
    expect(MAX_PROVIDER_ANSWER_BYTES).toBe(50_331_648)
    expect(MAX_PICTURE_BYTES).toBe(33_554_432)
    expect(MAX_PICTURE_SIDE).toBe(8_192)
    expect(MAX_PICTURE_PIXELS).toBe(24_000_000)
  })
})
