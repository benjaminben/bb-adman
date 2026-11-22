import { describe, it, expect } from 'vitest'
import { quietWindows } from '@/main/windows/quiet'
import { appWindowOptions } from '@/main/windows/app-window-options'

// Test launchers set ADMAN_QUIET_WINDOWS=1 so the app never takes over the screen.
describe('quiet windows switch', () => {
  it.each([
    ['on in an unpackaged app with the switch at 1', { ADMAN_QUIET_WINDOWS: '1' }, false, true],
    ['off with no switch', {}, false, false],
    ['ignored by a packaged app', { ADMAN_QUIET_WINDOWS: '1' }, true, false],
    ['off for the value true', { ADMAN_QUIET_WINDOWS: 'true' }, false, false],
    ['off for the value 0', { ADMAN_QUIET_WINDOWS: '0' }, false, false],
    ['off for an empty value', { ADMAN_QUIET_WINDOWS: '' }, false, false],
  ])('is %s', (_name, env: Record<string, string | undefined>, isPackaged, expected) => {
    expect(quietWindows(env, isPackaged)).toBe(expected)
  })
})

describe('app window settings in quiet mode', () => {
  it('only turns off background throttling and keeps every other setting', () => {
    const normal = appWindowOptions('/app/preload.cjs')
    const quiet = appWindowOptions('/app/preload.cjs', true)
    expect(normal.webPreferences).not.toHaveProperty('backgroundThrottling')
    expect(quiet).toEqual({
      ...normal,
      webPreferences: { ...normal.webPreferences, backgroundThrottling: false },
    })
  })
})
