// R2C-6 (spec/phases/round-2-campaign.md, design addition 5, "The subject dialog"): the new
// subject's ID, made as a brief's is and stepping around every existing ID, and the problems.
import { describe, expect, it } from 'vitest'
import { newSubjectId, subjectProblems } from '@/renderer/dialogs/subject-dialog/subject-plan'

const taken = (...ids: string[]) => ids.map((id) => ({ id }))

describe('newSubjectId [R2C-6]', () => {
  it.each([
    ['Harbour Blend', [], 'Harbour-Blend'],
    ['Harbour Blend', taken('Harbour-Blend'), 'Harbour-Blend-2'],
    ['Harbour Blend', taken('Harbour-Blend', 'Harbour-Blend-2'), 'Harbour-Blend-3'],
    ['  Harbour Blend  ', [], 'Harbour-Blend'],
    ['!!!???', [], 'subject'],
    ['!!!', taken('subject'), 'subject-2'],
  ])('%s with %j gives %s', (name, subjects, id) => {
    expect(newSubjectId(name, subjects)).toBe(id)
  })
})

describe('subjectProblems [R2C-6]', () => {
  it('gives a problem for a blank name and for no photo, in field order', () => {
    expect(subjectProblems({ name: '   ', photos: [] })).toEqual([
      { field: 'name', message: 'Enter a name.' },
      { field: 'photos', message: 'Add at least one photo.' },
    ])
  })

  it('gives none for a name and a photo', () => {
    expect(subjectProblems({ name: 'Harbour Blend', photos: ['/a/cup.png'] })).toEqual([])
  })

  it('does not ask for photos when editing', () => {
    expect(subjectProblems({ name: 'Harbour Blend', photos: null })).toEqual([])
    expect(subjectProblems({ name: '', photos: null })).toEqual([
      { field: 'name', message: 'Enter a name.' },
    ])
  })
})
