import { describe, it, expect } from 'vitest'
import { campaignPlan } from '../../../../../src/renderer/screens/project-home/campaign-input'
import type { BriefDraft } from '../../../../../src/shared/schemas/brief'
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

  it('refuses a subject with no ID, naming it', () => {
    const result = plan({ ...DRAFT, subjects: [{ name: 'Citrus can' }] })
    expect(result).toEqual({
      ok: false,
      problems: ['The subject "Citrus can" has no ID in the brief.'],
    })
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
