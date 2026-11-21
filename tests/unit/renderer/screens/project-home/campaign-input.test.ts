import { describe, it, expect } from 'vitest'
import { briefSubjectIds, campaignPlan } from '@/renderer/screens/project-home/campaign-input'
import type { BriefDraft } from '@/shared/schemas/brief'
import { SubjectId } from '@/shared/schemas/commands/subject'
import { DRAFT } from './project-fixture'

const parsed = (draft: BriefDraft, primaryLanguage: string | null = 'en') => ({
  draft,
  primaryLanguage,
})

function plan(draft: BriefDraft, primaryLanguage: string | null = 'en', existing: string[] = []) {
  return campaignPlan('P1', parsed(draft, primaryLanguage), existing)
}

describe('campaignPlan: the defaults for campaign.create [SPEC 14 1.41 TP-1, 6.1]', () => {
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

  it('creates a subject named twice in the brief only once', () => {
    const subjects = [
      { id: 'can', name: 'Can' },
      { id: 'can', name: 'Can again' },
    ]
    const result = plan({ ...DRAFT, subjects })
    if (!result.ok) throw new Error(result.problems.join())
    expect(result.subjects.map((s) => s.id)).toEqual(['can'])
    expect(result.campaign.subjectMap).toHaveLength(2)
  })

  it('makes an ID from the name for a subject with no ID [SPEC 14 1.43 T-1]', () => {
    const result = plan({ ...DRAFT, subjects: [{ name: 'Citrus can' }] })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.subjects.map((s) => s.id)).toEqual(['Citrus-can'])
  })

  it('refuses a subject ID the project could not store', () => {
    const result = plan({ ...DRAFT, subjects: [{ id: 'citrus can', name: 'Citrus can' }] })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.problems[0]).toContain('"citrus can"')
  })

  it('refuses a brief with no language and a region not in the table', () => {
    const result = plan({ ...DRAFT, languages: undefined }, null)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.problems).toContain('The brief gives no language.')
  })

  it('refuses a size it cannot read, naming it', () => {
    const result = plan({ ...DRAFT, sizes: ['1:1', 'huge'] })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.problems).toContain('The size "huge" cannot be read.')
  })

  it('refuses a brief whose message is missing, naming the field', () => {
    const result = plan({ ...DRAFT, message: undefined })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.problems).toEqual(['The brief\'s "message" is missing or empty.'])
  })

  it('refuses a brief with no subject', () => {
    const result = plan({ ...DRAFT, subjects: [] })
    expect(result.ok).toBe(false)
    if (!result.ok)
      expect(result.problems).toEqual(['The brief\'s "subjects" is missing or empty.'])
  })
})

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

  it('still names a brief ID with a space in it as a problem, and leaves it as it is', () => {
    const result = plan({ ...DRAFT, subjects: [{ id: 'citrus can', name: 'Citrus can' }] })
    expect(result.ok).toBe(false)
    expect(briefSubjectIds([{ id: 'citrus can' }])).toEqual([{ id: 'citrus can', made: false }])
  })

  it('maps the made IDs in subjectMap and skips one the project holds', () => {
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
