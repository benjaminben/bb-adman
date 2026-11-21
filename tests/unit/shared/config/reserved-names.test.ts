import { describe, it, expect } from 'vitest'
import { WINDOWS_RESERVED, isReserved } from '@/shared/config/reserved-names'

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

describe('the names added to the list [SPEC 6.5 1.20 B-01, 14 L8]', () => {
  const added = [
    'COM0',
    'LPT0',
    'COM¹',
    'COM²',
    'COM³',
    'LPT¹',
    'LPT²',
    'LPT³',
    'CONIN$',
    'CONOUT$',
  ]

  it.each(added)('reserves %s in both letter cases', (name) => {
    expect(isReserved(name)).toBe(true)
    expect(isReserved(name.toLowerCase())).toBe(true)
  })

  it.each(['com0.txt', 'CONOUT$.log', 'lpt².x'])('reserves %s, with an ending', (name) => {
    expect(isReserved(name)).toBe(true)
  })

  it.each(['COM10', 'CONIN', 'CON$', 'COM⁴', 'LPT00'])('allows %s', (name) => {
    expect(isReserved(name)).toBe(false)
  })
})
