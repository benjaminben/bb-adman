import { describe, it, expect } from 'vitest'
import { briefSubjectIds } from '@/shared/brief/subject-ids'
import { briefSubjectIds as fromWindow } from '@/renderer/screens/project-home/campaign-input'

// Round 2 plan R2P-2: briefSubjectIds moved to src/shared/brief; the window's old place
// gives the same function.
describe('briefSubjectIds in src/shared/brief [R2P-2]', () => {
  it('is the function the window uses', () => {
    expect(fromWindow).toBe(briefSubjectIds)
  })

  it('keeps a given ID and makes one from a name', () => {
    expect(
      briefSubjectIds([{ id: 'own' }, { name: 'Citrus Glow' }, { name: 'Citrus Glow' }]),
    ).toEqual([
      { id: 'own', made: false },
      { id: 'Citrus-Glow', made: true },
      { id: 'Citrus-Glow-2', made: true },
    ])
  })
})
