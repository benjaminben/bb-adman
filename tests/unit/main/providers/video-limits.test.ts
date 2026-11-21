import { describe, it, expect } from 'vitest'
import {
  MAX_VIDEO_BYTES,
  MAX_VIDEO_MS,
  MAX_VIDEO_SIDE,
} from '../../../../src/main/providers/picture-limits'

describe('video limits, one owner [SPEC 6.10.2 1.24, 14 CU-0]', () => {
  it('holds the three video values of the Section 6.10.2 table', () => {
    expect(MAX_VIDEO_BYTES).toBe(134_217_728)
    expect(MAX_VIDEO_SIDE).toBe(4_096)
    expect(MAX_VIDEO_MS).toBe(120_000)
  })
})
