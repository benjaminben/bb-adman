// R2C-2 (spec/phases/round-2-campaign.md, design addition 2): a language code's English name,
// for the grid's column heads; a code with no name is kept as it is.
import { describe, expect, it } from 'vitest'
import { languageName } from '@/renderer/ui/language-name'

describe('languageName [R2C-2]', () => {
  it.each([
    ['de', 'German'],
    ['en', 'English'],
    ['zz', 'zz'],
    ['not a code', 'not a code'],
  ])('names %s as %s', (code, name) => {
    expect(languageName(code)).toBe(name)
  })
})
