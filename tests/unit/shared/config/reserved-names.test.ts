import { describe, it, expect } from 'vitest'
import { WINDOWS_RESERVED, isReserved } from '../../../../src/shared/config/reserved-names'

describe('Windows reserved device names [SPEC 4.2 notes, 14 H14]', () => {
  it.each(['CON', 'con.backup', 'Aux.2026.final', 'NUL .x', 'com1', 'LPT9'])(
    'reserves %s',
    (name) => {
      expect(isReserved(name)).toBe(true)
    },
  )

  it.each(['CONTACT', 'Icon', 'My.CON', 'COM10'])('allows %s', (name) => {
    expect(isReserved(name)).toBe(false)
  })

  it('matches the whole name part, in any letter case', () => {
    expect(WINDOWS_RESERVED.test('pRn')).toBe(true)
    expect(WINDOWS_RESERVED.test('prn1')).toBe(false)
  })
})
