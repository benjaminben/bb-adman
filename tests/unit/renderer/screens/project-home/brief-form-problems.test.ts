import { describe, it, expect } from 'vitest'
import {
  emptySubject,
  formFromDraft,
  planFromForm,
  type BriefFormValues,
} from '@/renderer/screens/project-home/brief-form-model'
import { IMAGES, photosFor } from './brief-photo-fixture'
import { DRAFT } from './project-fixture'

function problemsOf(values: BriefFormValues, held: string[] = []): string[] {
  const result = planFromForm('P1', values, held, IMAGES)
  return result.ok ? [] : result.problems
}

const filled = (): BriefFormValues =>
  formFromDraft({ draft: DRAFT, primaryLanguage: 'en' }, [], photosFor(DRAFT))

type Change = (v: BriefFormValues) => void
const subject =
  (i: number, change: Partial<BriefFormValues['subjects'][number]>): Change =>
  (v) => {
    const row = v.subjects[i]
    if (row) v.subjects[i] = { ...row, ...change }
  }

const BAD_ID = 'may hold only A-Z, a-z, 0-9, - and _, up to 64 letters.'
const HELD =
  'Subject 1: the ID "citrus-can" is already in this project. Choose "Use a subject this project has", or another ID.'
const RTL = 'Right-to-left languages are not supported yet.'

describe('planFromForm: problems, each a line [screens-campaign "The brief form"]', () => {
  const cases: [string, Change, string[], string[]?][] = [
    ['a blank name', (v) => (v.campaignName = '  '), ['Enter the campaign name.']],
    ['a blank region', (v) => (v.region = ''), ['Enter the region.']],
    ['a blank audience', (v) => (v.audience = ''), ['Enter the audience.']],
    ['a blank message', (v) => (v.message = ' '), ['Enter the message.']],
    ['no subject', (v) => (v.subjects = []), ['Add at least one subject.']],
    ['a blank subject name', subject(1, { name: ' ' }), ['Subject 2: enter a name.']],
    ['a bad ID', subject(0, { newId: 'citrus can' }), [`Subject 1: the ID "citrus can" ${BAD_ID}`]],
    ['a new ID the project holds', subject(0, {}), [HELD], ['citrus-can']],
    ['one ID twice', subject(1, { newId: 'citrus-can' }), ['Subjects 1 and 2 have the same ID.']],
    ['no subject chosen', subject(0, { mode: 'existing' }), ['Subject 1: choose a subject.']],
    ['no size', (v) => (v.sizes.readyMade = []), ['Choose at least one size.']],
    ['an unread size', (v) => (v.sizes.other = '1:1.5, huge'), ['The size "huge" cannot be read.']],
    ['no language', (v) => (v.languages = ' , '), ['Give at least one language.']],
    ['a right-to-left language', (v) => (v.languages = 'en, ar_SA'), [RTL]],
    [
      'no campaign to copy',
      (v) => (v.rules.mode = 'copy'),
      ['Choose a campaign to copy the rules from.'],
    ],
    ['a size given twice', (v) => (v.sizes.other = '1:1'), ['Size labels must differ.']],
  ]

  it.each(cases)('names %s', (_, change, expected, held = []) => {
    const values = filled()
    change(values)
    expect(problemsOf(values, held)).toEqual(expected)
  })

  it('lists them in the ruled order, counting subjects from 1', () => {
    const values = formFromDraft(null, [])
    values.subjects.push({ ...emptySubject(), name: 'Can', mode: 'existing' })
    values.sizes.readyMade = []
    values.rules.mode = 'copy'
    expect(problemsOf(values)).toEqual([
      'Enter the campaign name.',
      'Enter the region.',
      'Enter the audience.',
      'Enter the message.',
      'Subject 1: enter a name.',
      'Subject 2: choose a subject.',
      'Subject 1: add at least one photo.',
      'Choose at least one size.',
      'Give at least one language.',
      'Choose a campaign to copy the rules from.',
    ])
  })
})

describe('planFromForm: a blank "Subject ID" is made from the name [ruling for S2-14]', () => {
  const sentIds = (values: BriefFormValues) => {
    const result = planFromForm('P1', values, [], IMAGES)
    if (!result.ok) throw new Error(result.problems.join())
    return {
      created: result.subjects.map((s) => s.id),
      mapped: result.campaign.subjectMap.map((m) => m.subjectId),
      brief: result.campaign.brief.subjects.map((s) => s.id),
    }
  }

  it('sends the ID made from the name, as the old summary did', () => {
    const values = filled()
    subject(0, { name: 'Summer Splash 2!', newId: '' })(values)
    const ids = sentIds(values)
    expect(ids.created).toEqual(['Summer-Splash-2', 'berry-bottle'])
    expect(ids.mapped).toEqual(['Summer-Splash-2', 'berry-bottle'])
    expect(ids.brief).toEqual(['Summer-Splash-2', 'berry-bottle'])
  })

  it('makes two blank IDs with one name differ, and steps around a typed one', () => {
    const values = filled()
    subject(0, { name: 'Lime can', newId: '' })(values)
    subject(1, { name: 'Lime can', newId: '' })(values)
    const photos = [{ assetId: 'A3', added: true }]
    values.subjects.push({ ...emptySubject(), name: 'Tall can', newId: 'Lime-can-2', photos })
    expect(sentIds(values).created).toEqual(['Lime-can', 'Lime-can-3', 'Lime-can-2'])
  })

  it.each([
    ['a blank name and ID: only the name line', ' ', ['Subject 1: enter a name.']],
    ['a made ID the project holds', 'citrus can', [HELD]],
  ])('names %s', (_, name, expected) => {
    const values = filled()
    subject(0, { name, newId: '' })(values)
    expect(problemsOf(values, ['citrus-can'])).toEqual(expected)
  })

  it('never shows a line for an empty ID', () => {
    const values = formFromDraft(null, [])
    values.subjects.push(emptySubject())
    expect(problemsOf(values).join('\n')).not.toContain('the ID ""')
  })
})

describe('planFromForm: one project subject chosen in two rows [ruling for S2-14]', () => {
  it('names the two rows that hold it', () => {
    const values = filled()
    subject(0, { mode: 'existing', existingId: 'lime-can' })(values)
    subject(1, { mode: 'existing', existingId: 'lime-can' })(values)
    expect(problemsOf(values, ['lime-can'])).toEqual(['Subjects 1 and 2 have the same ID.'])
  })
})
