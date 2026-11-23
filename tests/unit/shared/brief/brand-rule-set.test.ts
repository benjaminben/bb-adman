import { describe, it, expect } from 'vitest'
import { brandRuleSet } from '@/shared/brief/brand-rule-set'
import type { RuleSetValues } from '@/shared/schemas/commands/campaign'

const values = (): RuleSetValues => ({
  requiredAssetIds: ['A1', 'LOGO', 'A2'],
  palette: ['#111111'],
  requiredWords: { en: ['Fresh'] },
  prohibitedWords: { en: ['Cheap'] },
})

// spec/brief-brand.md "The rules" [A-397].
describe('brandRuleSet [spec/brief-brand.md "Shared helpers"]', () => {
  it('replaces the palette with a non-empty colour list', () => {
    expect(brandRuleSet(values(), ['#0B3D2E', '#FFF6E5'], undefined).palette).toEqual([
      '#0B3D2E',
      '#FFF6E5',
    ])
  })

  it.each([[[]], [undefined]])('keeps the palette when the colours are %j', (colours) => {
    expect(brandRuleSet(values(), colours, undefined).palette).toEqual(['#111111'])
  })

  it('adds the logo to the front of the required files', () => {
    expect(brandRuleSet(values(), undefined, 'NEW').requiredAssetIds).toEqual([
      'NEW',
      'A1',
      'LOGO',
      'A2',
    ])
  })

  it('moves a logo already listed to the front, once', () => {
    expect(brandRuleSet(values(), undefined, 'LOGO').requiredAssetIds).toEqual(['LOGO', 'A1', 'A2'])
  })

  it('leaves the required files alone with no logo', () => {
    expect(brandRuleSet(values(), undefined, undefined).requiredAssetIds).toEqual([
      'A1',
      'LOGO',
      'A2',
    ])
  })

  it('keeps the word lists', () => {
    const got = brandRuleSet(values(), ['#0B3D2E'], 'NEW')
    expect(got.requiredWords).toEqual({ en: ['Fresh'] })
    expect(got.prohibitedWords).toEqual({ en: ['Cheap'] })
  })

  it('does not change the input and shares nothing with it', () => {
    const input = values()
    const colours = ['#0B3D2E']
    const got = brandRuleSet(input, colours, 'LOGO')
    expect(input).toEqual(values())
    expect(colours).toEqual(['#0B3D2E'])
    expect(got.palette).not.toBe(colours)
    expect(got.requiredAssetIds).not.toBe(input.requiredAssetIds)
    expect(got.requiredWords).not.toBe(input.requiredWords)
    expect(got.requiredWords.en).not.toBe(input.requiredWords.en)
    expect(got.prohibitedWords.en).not.toBe(input.prohibitedWords.en)
    const kept = brandRuleSet(input, undefined, undefined)
    expect(kept.palette).not.toBe(input.palette)
  })
})
