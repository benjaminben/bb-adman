import { describe, it, expect } from 'vitest'
import {
  attachPlan,
  DEFAULT_PHOTO_USE,
  photoProblems,
  photoUseUpdate,
  rowPhotos,
  type PhotoUse,
} from '@/renderer/screens/project-home/brief-form-photos'
import {
  emptySubject,
  formFromDraft,
  planFromForm,
  type SubjectChoice,
} from '@/renderer/screens/project-home/brief-form-model'
import { assetRow } from '../../editor/editor-fixture'
import { DRAFT } from './project-fixture'

const added = (assetId: string) => ({ assetId, added: true })
const reused = (assetId: string) => ({ assetId, added: false })
const row = (over: Partial<SubjectChoice> = {}): SubjectChoice => ({
  ...emptySubject(),
  name: 'Can',
  ...over,
})
const existing = (id: string | null, over: Partial<SubjectChoice> = {}) =>
  row({ mode: 'existing', existingId: id, ...over })

// The row's "Use the photos" choice: its default and what it sends, in one table, so a
// change to the choice is one edit here and one in brief-form-photos.ts.
describe('the "Use the photos" choice [subject-photos "What a row shows", A-110]', () => {
  it('starts on "In the ad, as they are"', () => {
    expect(DEFAULT_PHOTO_USE).toBe('asset')
    expect(emptySubject().use).toBe(DEFAULT_PHOTO_USE)
  })

  const cases: [string, PhotoUse, ReturnType<typeof photoUseUpdate>][] = [
    ['"In the ad, as they are": the asset library', 'asset', { library: 'asset' }],
    ['"Only to guide AI pictures": the reference library', 'reference', { library: 'reference' }],
  ]
  it.each(cases)('%s', (_, use, update) => {
    expect(photoUseUpdate(use)).toEqual(update)
  })
})

// The choice other than the default, for the attach tests below.
const GUIDE: PhotoUse = 'reference'

const NO_PHOTO = 'Subject 1: add at least one photo.'
const READING = "The project's pictures are still being read."
const UNREAD = "The project's pictures could not be read."

describe('photoProblems: the photo lines [subject-photos "Problem lines", D-098]', () => {
  const images = [
    assetRow('A1'),
    assetRow('A2'),
    assetRow('C1', { subjectId: 'can-1' }),
    assetRow('M1', { subjectId: 'can-1', missing: true }),
    assetRow('V1', { subjectId: 'can-2', kind: 'video' }),
    assetRow('O1', { subjectId: 'other-can', displayName: 'other.png' }),
  ]
  const cases: [string, SubjectChoice[], string[]][] = [
    ['a new row with no photo: line 3', [row()], [NO_PHOTO]],
    ['a new row with a photo: no line', [row({ photos: [added('A1')] })], []],
    ['an existing row with no subject chosen: no line 3', [existing(null)], []],
    ['an existing row whose subject has an attached image: no line', [existing('can-1')], []],
    ['an attached image whose file is missing still counts [A-113]', [existing('can-9')], []],
    ['an attached video does not count', [existing('can-2')], [NO_PHOTO]],
    ['a photo not in images is ignored', [row({ photos: [added('GONE')] })], [NO_PHOTO]],
    [
      'adding: line 2',
      [row({ photos: [added('A1')], adding: true })],
      ['Subject 1: wait for the photos to be added.'],
    ],
    [
      'a reused photo attached to another subject: line 4 with its ID',
      [row({ photos: [reused('O1')] })],
      [
        'Subject 1: the photo "other.png" belongs to the subject "other-can". One photo belongs to one subject.',
      ],
    ],
    [
      'one asset in two rows, form photo and attached: line 5 naming the first row',
      [existing('can-1'), row({ photos: [reused('C1')] })],
      [
        'Subject 2: the photo "C1.png" belongs to the subject "can-1". One photo belongs to one subject.',
        'Subjects 1 and 2 use the same photo "C1.png". One photo belongs to one subject.',
      ],
    ],
    [
      'one form photo in two rows: line 5',
      [row({ photos: [added('A1')] }), row({ photos: [added('A2'), added('A1')] })],
      ['Subjects 1 and 2 use the same photo "A1.png". One photo belongs to one subject.'],
    ],
  ]

  it.each(cases)('%s', (_, subjects, expected) => {
    const list = [...images, assetRow('M2', { subjectId: 'can-9', missing: true })]
    expect(photoProblems(subjects, list, false)).toEqual(expected)
  })

  it.each([
    ['still being read', false, READING],
    ['refused', true, UNREAD],
  ])('images null (%s) gives line 1 once and hides lines 2 to 5', (_, refused, line) => {
    const subjects = [row({ adding: true }), row({ photos: [reused('O1')] })]
    expect(photoProblems(subjects, null, refused)).toEqual([line])
  })

  it('lists each kind over every row before the next kind', () => {
    const subjects = [
      row({ adding: true }),
      row({ photos: [reused('O1')], adding: true }),
      row({ photos: [added('A1')] }),
      row({ photos: [added('A1')] }),
      row(),
    ]
    expect(photoProblems(subjects, images, false)).toEqual([
      'Subject 1: wait for the photos to be added.',
      'Subject 2: wait for the photos to be added.',
      'Subject 1: add at least one photo.',
      'Subject 5: add at least one photo.',
      'Subject 2: the photo "other.png" belongs to the subject "other-can". One photo belongs to one subject.',
      'Subjects 3 and 4 use the same photo "A1.png". One photo belongs to one subject.',
    ])
  })
})

describe('rowPhotos: what a row holds [subject-photos "The model"]', () => {
  it('gives attached pictures first, oldest first, then the form photos in the order added', () => {
    const images = [
      assetRow('A2'),
      assetRow('N', { subjectId: 'can-1', createdAt: '2026-11-21T02:00:00.000Z' }),
      assetRow('O', { subjectId: 'can-1', createdAt: '2026-11-21T01:00:00.000Z' }),
      assetRow('A1'),
    ]
    const photos = rowPhotos(existing('can-1', { photos: [added('A1'), reused('A2')] }), images)
    expect(photos.map((p) => [p.asset.id, p.attached, p.added])).toEqual([
      ['O', true, false],
      ['N', true, false],
      ['A1', false, true],
      ['A2', false, false],
    ])
  })

  it("shows a form photo already attached to the row's own subject once, as attached", () => {
    const images = [assetRow('C1', { subjectId: 'can-1' })]
    const photos = rowPhotos(existing('can-1', { photos: [reused('C1')] }), images)
    expect(photos.map((p) => [p.asset.id, p.attached])).toEqual([['C1', true]])
  })
})

describe('attachPlan: the asset.update list Create sends [subject-photos "The model", A-115]', () => {
  const images = [
    assetRow('A1'),
    assetRow('A2'),
    assetRow('R1'),
    assetRow('C1', { subjectId: 'can-1' }),
  ]

  it("gives an added photo the row's choice and a reused unattached one no library", () => {
    const subjects = [row({ use: GUIDE, photos: [added('A1'), reused('R1')] })]
    expect(attachPlan('P1', subjects, ['can-new'], images)).toEqual([
      { projectId: 'P1', assetId: 'A1', subjectId: 'can-new', ...photoUseUpdate(GUIDE) },
      { projectId: 'P1', assetId: 'R1', subjectId: 'can-new' },
    ])
  })

  it("gives nothing for a photo already attached to the row's own subject", () => {
    const subjects = [existing('can-1', { photos: [reused('C1')] })]
    expect(attachPlan('P1', subjects, ['can-1'], images)).toEqual([])
  })

  it('goes row by row, then photo by photo, skipping a photo not in images', () => {
    const subjects = [
      row({ photos: [added('A2'), added('GONE'), added('A1')] }),
      existing('can-1', { photos: [added('R1')] }),
    ]
    expect(attachPlan('P1', subjects, ['a', 'can-1'], images).map((u) => u.assetId)).toEqual([
      'A2',
      'A1',
      'R1',
    ])
    expect(attachPlan('P1', subjects, ['a', 'can-1'], images)[2]).toEqual({
      projectId: 'P1',
      assetId: 'R1',
      subjectId: 'can-1',
      ...photoUseUpdate(DEFAULT_PHOTO_USE),
    })
  })
})

describe('the form model with photos [subject-photos "The model"]', () => {
  const draft = { ...DRAFT, subjects: [{ name: 'Can' }, { name: 'Bottle' }] }
  const open = (briefPhotos?: Parameters<typeof formFromDraft>[2]) =>
    formFromDraft({ draft, primaryLanguage: 'en' }, [], briefPhotos)

  it('starts a row on the default choice with no photo, no import and no note', () => {
    const start = { use: DEFAULT_PHOTO_USE, photos: [], adding: false, notes: [] }
    expect(emptySubject()).toMatchObject(start)
  })

  it("copies each subject's brief photos and notes into its row", () => {
    const notes = ['The photo "x.png" was not found.']
    const [first, second] = open([{ photos: [reused('A1')], notes }]).subjects
    expect(first).toMatchObject({ photos: [reused('A1')], notes })
    expect(second).toMatchObject({ photos: [], notes: [], use: DEFAULT_PHOTO_USE })
  })

  it('puts the photo lines after "choose a subject" and before the size lines', () => {
    const values = open()
    const [first] = values.subjects
    if (first) values.subjects[0] = { ...first, mode: 'existing' }
    values.sizes.readyMade = []
    const result = planFromForm('P1', values, [], [])
    expect(result.ok ? [] : result.problems).toEqual([
      'Subject 1: choose a subject.',
      'Subject 2: add at least one photo.',
      'Choose at least one size.',
    ])
  })

  it('applies no photo rule and attaches nothing while images are left out', () => {
    const result = planFromForm('P1', open(), [])
    expect(result.ok && result.attach).toEqual([])
  })

  it('gives the plan the attach list, with the IDs made from the names', () => {
    const values = open([
      { photos: [added('A1')], notes: [] },
      { photos: [added('A2')], notes: [] },
    ])
    const result = planFromForm('P1', values, [], [assetRow('A1'), assetRow('A2')])
    expect(result.ok && result.attach.map((u) => [u.assetId, u.subjectId])).toEqual([
      ['A1', 'Can'],
      ['A2', 'Bottle'],
    ])
  })
})
