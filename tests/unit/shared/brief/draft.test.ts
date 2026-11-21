import { describe, it, expect } from 'vitest'
import { briefDraftFrom, BRIEF_UNREADABLE } from '../../../../src/shared/brief/draft'

// The step parseBrief takes after either syntax has given a value (SPEC 14 1.9 slice B).
describe('briefDraftFrom: a parsed value to a BriefDraft [SPEC 6.1, 14 1.9]', () => {
  it('gives the fields of a brief object', () => {
    const value = {
      campaignName: 'Summer',
      region: 'US',
      audience: 'All',
      message: 'Hello',
      subjects: [{ id: 'bottle', name: 'Bottle', description: 'Blue' }],
      requiredWords: { en: ['Sale'] },
      prohibitedWords: ['Cheap'],
      languages: ['en'],
      sizes: ['1:1'],
      copy: { en: { headline: 'Hi', callToAction: 'Buy' } },
    }
    expect(briefDraftFrom(value)).toEqual({ ok: true, data: value })
  })

  it('drops unknown fields and fields of the wrong type, and keeps the rest', () => {
    const value = { campaignName: 'Summer', region: 7, extra: 'x', sizes: 'big', tone: 'warm' }
    expect(briefDraftFrom(value)).toEqual({
      ok: true,
      data: { campaignName: 'Summer', tone: 'warm' },
    })
  })

  it('gives an empty draft for an empty object', () => {
    expect(briefDraftFrom({})).toEqual({ ok: true, data: {} })
  })

  it('does not trim texts', () => {
    expect(briefDraftFrom({ message: '  Hello  ' })).toEqual({
      ok: true,
      data: { message: '  Hello  ' },
    })
  })

  it.each([
    ['an array', ['campaignName']],
    ['null', null],
    ['a string', 'campaignName: Summer'],
    ['a number', 42],
    ['true', true],
    ['undefined', undefined],
  ])('refuses %s at the top with brief_unreadable', (_name, value) => {
    expect(briefDraftFrom(value)).toEqual({ ok: false, error: BRIEF_UNREADABLE })
  })

  it('has the error of Section 4.1, which holds none of the brief', () => {
    expect(BRIEF_UNREADABLE).toEqual({
      code: 'INVALID_INPUT',
      message: 'The brief could not be read as JSON or YAML.',
      details: { reason: 'brief_unreadable' },
    })
    const result = briefDraftFrom('Secret launch plan')
    expect(JSON.stringify(result)).not.toContain('Secret')
  })
})
