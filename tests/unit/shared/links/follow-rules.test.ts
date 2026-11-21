import { describe, it, expect } from 'vitest'
import { GROUPS, followRule, isInherited, type Group } from '@/shared/links/follow-rules'

const MASTER = { width: 1080, height: 1080, language: 'en' }
const SIZES = {
  'same size': { width: 1080, height: 1080 },
  'same ratio, other pixels': { width: 2160, height: 2160 },
  'other ratio': { width: 1080, height: 1920 },
} as const
const LANGUAGES = { 'same language': 'en', 'other language': 'de' } as const

// spec/data-rules.md: geometry follows only at the same pixel size (no ratio rule, D-013),
// copy is a translation in another language, the other four always follow.
function expected(group: Group, sameSize: boolean, sameLanguage: boolean) {
  if (group === 'geometry') return sameSize ? 'follows' : 'none'
  if (group === 'copy') return sameLanguage ? 'follows' : 'translation'
  return 'follows'
}

const cells = GROUPS.flatMap((group) =>
  Object.entries(SIZES).flatMap(([sizeName, size]) =>
    Object.entries(LANGUAGES).map(([languageName, language]) => ({
      group,
      sizeName,
      languageName,
      variant: { ...size, language },
      word: expected(group, sizeName === 'same size', languageName === 'same language'),
    })),
  ),
)

describe('followRule [spec/links-and-sync.md, "Follow rules"; FR-079]', () => {
  it('covers 36 cells: six groups, three sizes, two languages', () => {
    expect(GROUPS).toEqual(['copy', 'style', 'geometry', 'source', 'timing', 'animation'])
    expect(cells).toHaveLength(36)
  })

  it.each(cells)('$group, $sizeName, $languageName: $word', ({ group, variant, word }) => {
    expect(followRule(group, MASTER, variant)).toBe(word)
  })
})

describe('isInherited [spec/links-and-sync.md, "Overrides"]', () => {
  const same = { ...MASTER }
  const otherSize = { ...MASTER, width: 1920 }
  const otherLanguage = { ...MASTER, language: 'de' }
  it.each([
    { path: 'copy', variant: same, inherited: true },
    { path: 'copy', variant: otherLanguage, inherited: false },
    { path: 'copy', variant: otherSize, inherited: true },
    { path: 'geometry', variant: same, inherited: true },
    { path: 'geometry', variant: otherSize, inherited: false },
    { path: 'geometry', variant: otherLanguage, inherited: true },
    { path: 'style.color', variant: otherSize, inherited: true },
    { path: 'style.color', variant: otherLanguage, inherited: true },
    { path: 'animation.exit', variant: otherSize, inherited: true },
    { path: 'animation.exit', variant: otherLanguage, inherited: true },
    { path: 'name', variant: same, inherited: false },
    { path: 'visible', variant: same, inherited: false },
  ])('$path on $variant.width x $variant.height, $variant.language: $inherited', (row) => {
    expect(isInherited(row.path, MASTER, row.variant)).toBe(row.inherited)
  })
})
