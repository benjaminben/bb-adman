import { describe, it, expect } from 'vitest'
import {
  emptySubject,
  formFromDraft,
  planFromForm,
  type BriefFormValues,
} from '@/renderer/screens/project-home/brief-form-model'
import type { BriefDraft } from '@/shared/schemas/brief'
import { IMAGES, photosFor } from './brief-photo-fixture'
import { DRAFT } from './project-fixture'

const parsed = (draft: BriefDraft, primaryLanguage: string | null = 'en') => ({
  draft,
  primaryLanguage,
})

function plan(draft: BriefDraft, primaryLanguage: string | null = 'en', held: string[] = []) {
  const values = formFromDraft(parsed(draft, primaryLanguage), held, photosFor(draft))
  return planFromForm('P1', values, held, IMAGES)
}

const filled = (): BriefFormValues => formFromDraft(parsed(DRAFT), [], photosFor(DRAFT))

describe('formFromDraft: the form filled from a brief [screens-campaign "The brief form"]', () => {
  it('fills every text as the brief has it, nothing trimmed', () => {
    const values = formFromDraft(parsed({ ...DRAFT, tone: '  warm ', offer: '2 for 1' }), [])
    expect(values).toMatchObject({
      campaignName: 'Summer Splash',
      region: 'US',
      audience: 'Adults 21 to 35',
      message: DRAFT.message,
      offer: '2 for 1',
      callToAction: '',
      tone: '  warm ',
    })
  })

  it('gives each subject its ID, made from the name when the brief has none', () => {
    const subjects = [{ id: 'berry-bottle', name: 'Berry bottle' }, { name: 'Citrus can' }]
    const values = formFromDraft(parsed({ ...DRAFT, subjects }), ['berry-bottle'])
    const [held, made] = values.subjects
    expect(held).toMatchObject({
      mode: 'existing',
      newId: 'berry-bottle',
      existingId: 'berry-bottle',
    })
    expect(made).toEqual({ ...emptySubject(), name: 'Citrus can', newId: 'Citrus-can' })
  })

  it.each([
    ['ready-made ratios', ['9:16', '1:1'], ['9x16', '1x1'], '', '9x16'],
    [
      'a pixel size and an unread one',
      ['1200x628', 'huge', '4x5'],
      ['4x5'],
      '1200x628, huge',
      '1200x628',
    ],
    ['no size', undefined, ['1x1', '9x16', '16x9'], '', '1x1'],
    ['an empty list', [], ['1x1', '9x16', '16x9'], '', '1x1'],
  ])('reads sizes: %s', (_, sizes, readyMade, other, master) => {
    const values = formFromDraft(parsed({ ...DRAFT, sizes }), [])
    expect(values.sizes).toEqual({ readyMade, other, master })
  })

  it.each([
    ["the brief's own", ['en', 'de'], 'fr', 'en, de'],
    ['the region table', undefined, 'fr', 'fr'],
    ['none', [], null, ''],
  ])('fills languages from %s', (_, languages, primary, expected) => {
    expect(formFromDraft(parsed({ ...DRAFT, languages }, primary), []).languages).toBe(expected)
  })

  it('puts word lists under each language, one per line', () => {
    const draft = { ...DRAFT, requiredWords: ['sip', 'cool'], prohibitedWords: { de: ['billig'] } }
    expect(formFromDraft(parsed(draft), []).rules).toEqual({
      mode: 'words',
      copyFrom: null,
      requiredWords: { en: 'sip\ncool' },
      prohibitedWords: { de: 'billig' },
    })
  })

  it('opens empty for "Type a brief", with one empty new subject and the default sizes', () => {
    const values = formFromDraft(null, [])
    expect(values.campaignName).toBe('')
    expect(values.subjects).toEqual([emptySubject()])
    expect(values.sizes).toEqual({ readyMade: ['1x1', '9x16', '16x9'], other: '', master: '1x1' })
    expect(values.languages).toBe('')
    expect(values.copy).toBeUndefined()
  })
})

describe('planFromForm: what "Create campaign" sends [FR-023, FR-024, FR-026]', () => {
  it('sends the form as the brief, with every subject made first', () => {
    const result = plan({ ...DRAFT, callToAction: 'Find it', copy: { en: { headline: 'Hi' } } })
    if (!result.ok) throw new Error(result.problems.join())
    expect(result.subjects).toEqual([
      { projectId: 'P1', id: 'citrus-can', name: 'Citrus can', description: 'A slim can' },
      { projectId: 'P1', id: 'berry-bottle', name: 'Berry bottle', description: '' },
    ])
    expect(result.attach.map((u) => u.subjectId)).toEqual(['citrus-can', 'berry-bottle'])
    expect(result.campaign).toEqual({
      projectId: 'P1',
      brief: {
        campaignName: 'Summer Splash',
        region: 'US',
        audience: 'Adults 21 to 35',
        message: DRAFT.message,
        callToAction: 'Find it',
        subjects: [
          { id: 'citrus-can', name: 'Citrus can', description: 'A slim can' },
          { id: 'berry-bottle', name: 'Berry bottle', description: '' },
        ],
        languages: ['en', 'de'],
        sizes: ['1080x1080', '1080x1920'],
        copy: { en: { headline: 'Hi' } },
      },
      subjectMap: [
        { subjectId: 'citrus-can', create: false },
        { subjectId: 'berry-bottle', create: false },
      ],
      languages: ['en', 'de'],
      sizes: [
        { label: '1x1', width: 1080, height: 1080 },
        { label: '9x16', width: 1080, height: 1920 },
      ],
      templateId: 'starter',
    })
  })

  it('sends no subject.create for a subject the project holds, and its typed name', () => {
    const values = filled()
    values.subjects[0] = {
      ...emptySubject(),
      name: 'My can',
      mode: 'existing',
      existingId: 'can-1',
      photos: [{ assetId: 'A1', added: true }],
    }
    const result = planFromForm('P1', values, ['can-1'], IMAGES)
    if (!result.ok) throw new Error(result.problems.join())
    expect(result.subjects.map((s) => s.id)).toEqual(['berry-bottle'])
    expect(result.campaign.brief.subjects[0]).toEqual({
      id: 'can-1',
      name: 'My can',
      description: '',
    })
    expect(result.campaign.subjectMap[0]).toEqual({ subjectId: 'can-1', create: false })
  })

  it('puts the master size first and adds other sizes', () => {
    const values = filled()
    values.sizes = { readyMade: ['1x1', '4x5'], other: '1200x628, 2:1', master: '1200x628' }
    const result = planFromForm('P1', values, [], IMAGES)
    if (!result.ok) throw new Error(result.problems.join())
    const labels = ['1200x628', '1x1', '4x5', '2160x1080']
    expect(result.campaign.sizes.map((s) => s.label)).toEqual(labels)
    expect(result.campaign.brief.sizes?.[0]).toBe('1200x628')
  })

  it('splits languages on commas and spaces, in order', () => {
    const values = { ...filled(), languages: ' fr-CA,en  de,' }
    const result = planFromForm('P1', values, [], IMAGES)
    if (!result.ok) throw new Error(result.problems.join())
    expect(result.campaign.languages).toEqual(['fr-CA', 'en', 'de'])
  })

  it('sends word lists by language, dropping blank lines and empty lists', () => {
    const values = filled()
    values.rules.requiredWords = { en: 'sip\n\n cool \n', de: '' }
    values.rules.prohibitedWords = { en: '\n' }
    const result = planFromForm('P1', values, [], IMAGES)
    if (!result.ok) throw new Error(result.problems.join())
    expect(result.campaign.brief.requiredWords).toEqual({ en: ['sip', 'cool'] })
    expect(result.campaign.brief.prohibitedWords).toBeUndefined()
    expect(result.campaign.ruleSet).toBeUndefined()
    expect(result.campaign.copyRuleSetFrom).toBeUndefined()
  })

  it('puts a plain word list under the main language when the brief gave none', () => {
    const draft = { ...DRAFT, languages: [], requiredWords: ['sip'] }
    const values = formFromDraft(parsed(draft, null), [], photosFor(draft))
    values.languages = 'fr'
    const result = planFromForm('P1', values, [], IMAGES)
    if (!result.ok) throw new Error(result.problems.join())
    expect(result.campaign.brief.requiredWords).toEqual({ fr: ['sip'] })
  })

  it('sends copyRuleSetFrom when the rules are copied', () => {
    const values = filled()
    values.rules = { ...values.rules, mode: 'copy', copyFrom: 'C9' }
    const result = planFromForm('P1', values, [], IMAGES)
    if (!result.ok) throw new Error(result.problems.join())
    expect(result.campaign.copyRuleSetFrom).toBe('C9')
  })
})

// Moved from campaign-input.test.ts (campaignPlan gave way to planFromForm), with the new
// problem wording.
describe('planFromForm(formFromDraft(…)): the defaults for campaign.create [SPEC 14 1.41 TP-1, 6.1]', () => {
  it('creates each subject of the brief once and maps it as existing', () => {
    const result = plan(DRAFT)
    if (!result.ok) throw new Error(result.problems.join())
    expect(result.subjects).toEqual([
      { projectId: 'P1', id: 'citrus-can', name: 'Citrus can', description: 'A slim can' },
      { projectId: 'P1', id: 'berry-bottle', name: 'Berry bottle', description: '' },
    ])
    expect(result.campaign.subjectMap).toEqual([
      { subjectId: 'citrus-can', create: false },
      { subjectId: 'berry-bottle', create: false },
    ])
  })

  it("uses the brief's own languages and sizes, and the starter template", () => {
    const result = plan(DRAFT)
    if (!result.ok) throw new Error(result.problems.join())
    expect(result.campaign.languages).toEqual(['en', 'de'])
    expect(result.campaign.sizes.map((s) => s.label)).toEqual(['1x1', '9x16'])
    expect(result.campaign.templateId).toBe('starter')
    expect(result.campaign.ruleSet).toBeUndefined()
    expect(result.campaign.copyRuleSetFrom).toBeUndefined()
    expect(result.campaign.brief.message).toBe(DRAFT.message)
  })

  it("falls back to the region's language and the ready-made sizes picked by default", () => {
    const result = plan({ ...DRAFT, languages: [], sizes: undefined }, 'en')
    if (!result.ok) throw new Error(result.problems.join())
    expect(result.campaign.languages).toEqual(['en'])
    expect(result.campaign.sizes).toEqual([
      { label: '1x1', width: 1080, height: 1080 },
      { label: '9x16', width: 1080, height: 1920 },
      { label: '16x9', width: 1920, height: 1080 },
    ])
  })

  it('does not create a subject the project already holds', () => {
    const result = plan(DRAFT, 'en', ['citrus-can'])
    if (!result.ok) throw new Error(result.problems.join())
    expect(result.subjects.map((s) => s.id)).toEqual(['berry-bottle'])
    expect(result.campaign.subjectMap).toHaveLength(2)
  })

  it('names a subject given twice in the brief as a problem', () => {
    const subjects = [
      { id: 'can', name: 'Can' },
      { id: 'can', name: 'Can again' },
    ]
    const result = plan({ ...DRAFT, subjects })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.problems).toEqual(['Subjects 1 and 2 have the same ID.'])
  })

  it('makes an ID from the name for a subject with no ID [SPEC 14 1.43 T-1]', () => {
    const result = plan({ ...DRAFT, subjects: [{ name: 'Citrus can' }] })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.subjects.map((s) => s.id)).toEqual(['Citrus-can'])
  })

  it('refuses a subject ID the project could not store', () => {
    const result = plan({ ...DRAFT, subjects: [{ id: 'citrus can', name: 'Citrus can' }] })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.problems[0]).toContain('Subject 1: the ID "citrus can"')
  })

  it('refuses a brief with no language and a region not in the table', () => {
    const result = plan({ ...DRAFT, languages: undefined }, null)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.problems).toContain('Give at least one language.')
  })

  it('refuses a size it cannot read, naming it', () => {
    const result = plan({ ...DRAFT, sizes: ['1:1', 'huge'] })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.problems).toContain('The size "huge" cannot be read.')
  })

  it('refuses a brief whose message is missing, naming the field', () => {
    const result = plan({ ...DRAFT, message: undefined })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.problems).toEqual(['Enter the message.'])
  })

  it('refuses a brief with no subject', () => {
    const result = plan({ ...DRAFT, subjects: [] })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.problems).toEqual(['Add at least one subject.'])
  })

  it('maps the made IDs in subjectMap and skips one the project holds [SPEC 14 1.43 P1-4]', () => {
    const subjects = [{ name: 'Citrus can' }, { name: 'Berry bottle' }]
    const result = plan({ ...DRAFT, subjects }, 'en', ['Citrus-can'])
    if (!result.ok) throw new Error(result.problems.join())
    expect(result.subjects.map((s) => s.id)).toEqual(['Berry-bottle'])
    expect(result.campaign.subjectMap).toEqual([
      { subjectId: 'Citrus-can', create: false },
      { subjectId: 'Berry-bottle', create: false },
    ])
  })
})
