import { describe, it, expect } from 'vitest'
import { briefSubjectIds } from '@/renderer/screens/project-home/campaign-input'
import { SubjectId } from '@/shared/schemas/commands/subject'

describe('briefSubjectIds: an ID made from the name [SPEC 14 1.43 T-1, P1-4]', () => {
  const made = (...names: string[]) => briefSubjectIds(names.map((name) => ({ name })))

  it('turns spaces into - and drops other characters', () => {
    expect(made('Summer Splash 2!')).toEqual([{ id: 'Summer-Splash-2', made: true }])
  })

  it('turns a run of spaces into one -', () => {
    expect(made('a   b')[0]?.id).toBe('a-b')
  })

  it('gives subject for a name of only other characters', () => {
    expect(made('!!!¿?')[0]?.id).toBe('subject')
  })

  it('gives x and x-2 for two subjects named alike', () => {
    expect(made('x', 'x!', 'x').map((s) => s.id)).toEqual(['x', 'x-2', 'x-3'])
  })

  it('cuts a 70-character name to 64 characters that pass SubjectId', () => {
    const [first, second] = made('a'.repeat(70), 'a'.repeat(70))
    expect(first?.id).toHaveLength(64)
    expect(SubjectId.safeParse(first?.id).success).toBe(true)
    expect(second?.id).toBe(`${'a'.repeat(62)}-2`)
  })

  it("keeps the brief's own ID and marks it as not made", () => {
    expect(briefSubjectIds([{ id: 'can', name: 'Can' }])).toEqual([{ id: 'can', made: false }])
  })

  it('does not reuse an ID the brief gives another subject', () => {
    const ids = briefSubjectIds([{ name: 'can' }, { id: 'can', name: 'Can' }])
    expect(ids).toEqual([
      { id: 'can-2', made: true },
      { id: 'can', made: false },
    ])
  })

  // The problem line for this ID is now checked in brief-form-model.test.ts.
  it('leaves a brief ID with a space in it as it is', () => {
    expect(briefSubjectIds([{ id: 'citrus can' }])).toEqual([{ id: 'citrus can', made: false }])
  })
})
