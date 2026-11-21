import { describe, it, expect } from 'vitest'
import { Brief, BriefDraft } from '@/shared/schemas/brief'
import {
  CampaignSize,
  campaignCreateInput,
  campaignCreateToolInput,
} from '@/shared/schemas/commands/campaign'
import { TextStyle } from '@/shared/schemas/layer'
import { READY_MADE_SIZES } from '@/shared/config/defaults'
import { JOB_KIND_CLASSES, JOBS_AT_ONCE_PER_PROVIDER } from '@/shared/config/job-kinds'

const brief = {
  campaignName: 'Summer',
  region: 'US',
  audience: 'Everyone',
  message: 'Stay cool',
  subjects: [{ name: 'Bottle' }],
}

describe('Brief and BriefDraft [SPEC 6.1]', () => {
  it('BriefDraft drops a field of the wrong type and unknown fields instead of refusing', () => {
    expect(BriefDraft.parse({ campaignName: 3, region: 'US', extra: true })).toEqual({
      region: 'US',
    })
    expect(BriefDraft.parse({})).toEqual({})
  })

  it('Brief needs the four texts and at least one named subject', () => {
    expect(Brief.safeParse(brief).success).toBe(true)
    expect(Brief.safeParse({ ...brief, subjects: [] }).success).toBe(false)
    expect(Brief.safeParse({ ...brief, message: ' ' }).success).toBe(false)
    expect(Brief.safeParse({ ...brief, subjects: [{ name: '' }] }).success).toBe(false)
  })

  it('accepts both forms of a word list', () => {
    expect(Brief.safeParse({ ...brief, requiredWords: ['cool'] }).success).toBe(true)
    expect(Brief.safeParse({ ...brief, prohibitedWords: { 'en-US': ['hot'] } }).success).toBe(true)
  })
})

describe('CampaignSize and the ready-made sizes [SPEC 3.3, FR-247]', () => {
  it('allows the label 4x5 and refuses a label that is not file-safe', () => {
    expect(CampaignSize.safeParse({ label: '4x5', width: 1080, height: 1350 }).success).toBe(true)
    expect(CampaignSize.safeParse({ label: '4:5', width: 1080, height: 1350 }).success).toBe(false)
  })

  it('holds the four ready-made sizes, three selected by default', () => {
    expect(READY_MADE_SIZES).toEqual([
      { label: '1x1', width: 1080, height: 1080, selectedByDefault: true },
      { label: '9x16', width: 1080, height: 1920, selectedByDefault: true },
      { label: '16x9', width: 1920, height: 1080, selectedByDefault: true },
      { label: '4x5', width: 1080, height: 1350, selectedByDefault: false },
    ])
  })
})

describe('campaign.create input [SPEC 6.1]', () => {
  const input = {
    projectId: 'p1',
    brief,
    subjectMap: [{ subjectId: 'bottle-1', create: true }],
    languages: ['en-US'],
    sizes: [{ label: '1x1', width: 1080, height: 1080 }],
    templateId: 'starter',
  }

  it('accepts a valid input', () => {
    expect(campaignCreateInput.safeParse(input).success).toBe(true)
  })

  it('refuses a wrong number of subject entries, repeated labels, and both rule set inputs', () => {
    expect(campaignCreateInput.safeParse({ ...input, subjectMap: [] }).success).toBe(false)
    expect(
      campaignCreateInput.safeParse({ ...input, sizes: [...input.sizes, ...input.sizes] }).success,
    ).toBe(false)
    const ruleSet = { requiredAssetIds: [], palette: [], requiredWords: {}, prohibitedWords: {} }
    expect(
      campaignCreateInput.safeParse({ ...input, ruleSet, copyRuleSetFrom: 'c2' }).success,
    ).toBe(false)
  })

  it.each([
    { value: true, ok: true },
    { value: false, ok: true },
    { value: undefined, ok: true },
    { value: 'false', ok: false },
    { value: 0, ok: false },
    { value: null, ok: false },
  ])('placeSubjectPhoto $value is accepted: $ok [SP-6]', ({ value, ok }) => {
    const parsed = campaignCreateInput.safeParse({ ...input, placeSubjectPhoto: value })
    expect(parsed.success).toBe(ok)
    if (parsed.success) expect(parsed.data.placeSubjectPhoto).toBe(value)
  })

  it('gives the MCP tool schema no placeSubjectPhoto, with the same refinements [SP-6, A-122]', () => {
    expect(Object.keys(campaignCreateToolInput.shape)).not.toContain('placeSubjectPhoto')
    expect(Object.keys(campaignCreateToolInput.shape)).toEqual(
      Object.keys(campaignCreateInput.shape).filter((k) => k !== 'placeSubjectPhoto'),
    )
    expect(campaignCreateToolInput.safeParse(input).success).toBe(true)
    expect(campaignCreateToolInput.safeParse({ ...input, subjectMap: [] }).success).toBe(false)
    const ruleSet = { requiredAssetIds: [], palette: [], requiredWords: {}, prohibitedWords: {} }
    expect(
      campaignCreateToolInput.safeParse({ ...input, ruleSet, copyRuleSetFrom: 'c2' }).success,
    ).toBe(false)
  })
})

describe('TextStyle.letterSpacing [SPEC 3.3, FR-249]', () => {
  const style = {
    fontAssetId: null,
    fontSize: 48,
    fontWeight: 700,
    color: '#112233',
    align: 'center',
    lineHeight: 1.2,
  }
  it('is required and lies between -0.2 and 1', () => {
    expect(TextStyle.safeParse({ ...style, letterSpacing: -0.2 }).success).toBe(true)
    expect(TextStyle.safeParse({ ...style, letterSpacing: 1 }).success).toBe(true)
    expect(TextStyle.safeParse({ ...style, letterSpacing: 1.1 }).success).toBe(false)
    expect(TextStyle.safeParse(style).success).toBe(false)
  })
})

describe('job kinds [SPEC 3.6, D-036]', () => {
  it('places the ten kinds and runs four at once per provider', () => {
    expect(JOB_KIND_CLASSES).toEqual({
      image_generation: 'background',
      video_generation: 'background',
      export: 'background',
      publish: 'background',
      cutout: 'background',
      generative_fill: 'attached',
      layout_proposal: 'attached',
      copy_options: 'attached',
      translation: 'attached',
      brief_extraction: 'attached',
    })
    expect(JOBS_AT_ONCE_PER_PROVIDER).toBe(4)
  })
})
