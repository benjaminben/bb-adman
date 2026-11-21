import { describe, it, expect } from 'vitest'
import { videoFrameSwitch, videoRefSwitch, videoSwitch } from '../../e2e-real/switches'

describe('the real first-frame video case runs only with ADMAN_E2E_VIDEO_FRAME=1 [SPEC 14 1.60 N-11]', () => {
  it('is off with nothing set', () => {
    expect(videoFrameSwitch({})).toBe(false)
  })

  it('is on only for exactly 1', () => {
    expect(videoFrameSwitch({ ADMAN_E2E_VIDEO_FRAME: '1' })).toBe(true)
    for (const value of ['0', 'true', 'yes', ' 1', '']) {
      expect(videoFrameSwitch({ ADMAN_E2E_VIDEO_FRAME: value })).toBe(false)
    }
  })

  it('is not turned on by the other video switches, and turns none of them on', () => {
    expect(videoFrameSwitch({ ADMAN_E2E_VIDEO: '1', ADMAN_E2E_VIDEO_REF: '1' })).toBe(false)
    expect(videoSwitch({ ADMAN_E2E_VIDEO_FRAME: '1' })).toBe(false)
    expect(videoRefSwitch({ ADMAN_E2E_VIDEO_FRAME: '1' })).toBe(false)
  })
})

describe('the real reference video case runs only with ADMAN_E2E_VIDEO_REF=1 [SPEC 14 1.60 N-11]', () => {
  it('is off with nothing set', () => {
    expect(videoRefSwitch({})).toBe(false)
  })

  it('is on only for exactly 1', () => {
    expect(videoRefSwitch({ ADMAN_E2E_VIDEO_REF: '1' })).toBe(true)
    for (const value of ['0', 'true', 'yes', ' 1', '']) {
      expect(videoRefSwitch({ ADMAN_E2E_VIDEO_REF: value })).toBe(false)
    }
  })

  it('is not turned on by the other video switches, and turns none of them on', () => {
    expect(videoRefSwitch({ ADMAN_E2E_VIDEO: '1', ADMAN_E2E_VIDEO_FRAME: '1' })).toBe(false)
    expect(videoSwitch({ ADMAN_E2E_VIDEO_REF: '1' })).toBe(false)
  })
})
