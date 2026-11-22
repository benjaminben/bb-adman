// Review fix (spec/phases/review-leftovers.md, P10-9 review Low 2): ADMAN_USER_DATA_DIR moves
// the app data folder for test runs of an unpackaged app only. A packaged app ignores it.
import { describe, expect, it } from 'vitest'
import { userDataOverride } from '@/main/user-data-override'

describe('userDataOverride', () => {
  it.each<[string, boolean, string | undefined, string | null]>([
    [
      'an unpackaged app with the value set uses it',
      false,
      '/tmp/box/userData',
      '/tmp/box/userData',
    ],
    ['an unpackaged app without it keeps the default', false, undefined, null],
    ['an unpackaged app with it empty keeps the default', false, '', null],
    ['a packaged app ignores it', true, '/tmp/box/userData', null],
    ['a packaged app without it keeps the default', true, undefined, null],
  ])('%s', (_, isPackaged, value, expected) => {
    expect(userDataOverride({ ADMAN_USER_DATA_DIR: value }, isPackaged)).toBe(expected)
  })
})
