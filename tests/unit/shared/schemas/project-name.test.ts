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

  it('accepts names that only contain a reserved name', () => {
    for (const name of ['CONSOLE', 'COM10', 'LPT0', 'Auxiliary', 'Null']) {
      expect(valid(name), name).toBe(true)
    }
  })
})
