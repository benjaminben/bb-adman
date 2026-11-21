import { describe, it, expect } from 'vitest'
import { devToolsEnabled } from '@/main/dev-tools-flag'

describe('devTools is on only in an unpackaged app with ADMAN_DEV_TOOLS=1 [SPEC 13]', () => {
  it('is on when not packaged and the variable is 1', () => {
    expect(devToolsEnabled(false, { ADMAN_DEV_TOOLS: '1' })).toBe(true)
  })

  it('is off in a packaged app even when the variable is 1', () => {
    expect(devToolsEnabled(true, { ADMAN_DEV_TOOLS: '1' })).toBe(false)
  })

  it.each([undefined, '', '0', 'true', 'yes'])('is off when the variable is %s', (value) => {
    expect(devToolsEnabled(false, { ADMAN_DEV_TOOLS: value })).toBe(false)
  })
})
