import { describe, it, expect } from 'vitest'
import { projectCreateInput } from '../../../../src/shared/schemas/commands/project'

const valid = (name: string) => projectCreateInput.safeParse({ name, location: '/x' }).success

describe('project names refuse the names Windows reserves [SPEC 4.2 notes]', () => {
  it('refuses CON, PRN, AUX, NUL, COM1 to COM9 and LPT1 to LPT9 in any letter case', () => {
    const reserved = ['CON', 'PRN', 'AUX', 'NUL']
    for (let i = 1; i <= 9; i++) reserved.push(`COM${i}`, `LPT${i}`)
    for (const name of reserved) {
      expect(valid(name), name).toBe(false)
      expect(valid(name.toLowerCase()), name).toBe(false)
    }
    expect(valid('Con')).toBe(false)
    expect(valid('  nul  ')).toBe(false)
  })

  it('refuses LPT0, added to the list [SPEC 6.5 1.20 B-01, 14 L8]', () => {
    expect(valid('LPT0')).toBe(false)
    expect(valid('lpt0')).toBe(false)
  })

  it('accepts names that only contain a reserved name', () => {
    for (const name of ['CONSOLE', 'COM10', 'Auxiliary', 'Null']) {
      expect(valid(name), name).toBe(true)
    }
  })

  it.each(['CON', 'con.backup', 'Aux.2026.final', 'NUL .x', 'lpt3.adman'])(
    'refuses %j: the part before the first dot, spaces dropped from its end, is reserved [1.7]',
    (name) => {
      expect(valid(name)).toBe(false)
    },
  )

  it.each(['CONTACT', 'Icon', 'My.CON', 'COM10', 'CONSOLE.backup'])(
    'allows %j, which only contains a reserved word [1.7]',
    (name) => {
      expect(valid(name)).toBe(true)
    },
  )
})
