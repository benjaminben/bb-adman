import { describe, it, expect } from 'vitest'
import { videoSwitch } from '../../e2e-real/switches'

describe('the real video case runs only with ADMAN_E2E_VIDEO=1 [SPEC 14 1.57 TP-6]', () => {
  it('is off with nothing set', () => {
    expect(videoSwitch({})).toBe(false)
  })

  it('is on only for exactly 1', () => {
    expect(videoSwitch({ ADMAN_E2E_VIDEO: '1' })).toBe(true)
    for (const value of ['0', 'true', 'yes', ' 1', '']) {
      expect(videoSwitch({ ADMAN_E2E_VIDEO: value })).toBe(false)
    }
  })

  it('is not turned on by the other switches', () => {
    expect(videoSwitch({ ADMAN_E2E_MOSS: '1', ADMAN_E2E_FLUX: '1' })).toBe(false)
  })
})
