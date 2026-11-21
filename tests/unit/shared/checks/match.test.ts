import { describe, expect, it } from 'vitest'
import { cleanList, matches } from '@/shared/checks/match'

describe('word matching (A-153, FR-240)', () => {
  it.each([
    ['a word inside a longer word does not match', 'wholesale prices', 'sale', 'en', false],
    ['a word next to punctuation matches', 'Big Sale!', 'sale', 'en', true],
    ['a word at the start matches', 'sale today', 'sale', 'en', true],
    ['a phrase on word boundaries matches', 'The Big Sale is here', 'big sale', 'en', true],
    ['a phrase split across words does not match', 'The bigger sale', 'big sale', 'en', false],
    ['a later occurrence on boundaries matches', 'wholesale, then sale', 'sale', 'en', true],
    ['punctuation matches anywhere', 'Buy now!Today', '!', 'en', true],
    ['a symbol alone matches anywhere', 'Only 50%off', '%', 'en', true],
    ['a symbol that is absent does not match', 'Only fifty off', '%', 'en', false],
    ['full-width letters are normalised (NFKC)', 'ＦＲＥＥ glorp', 'free', 'en', true],
    ['a Turkish dotted capital I matches with tr', 'İNDİRİM bugün', 'indirim', 'tr-TR', true],
    ['Japanese is a plain substring', 'きょうはセールです', 'セール', 'ja-JP', true],
    ['Chinese is a plain substring', '今天大减价活动', '减价', 'zh-CN', true],
    ['Korean is a plain substring', '오늘할인행사', '할인', 'ko', true],
    ['Thai is a plain substring', 'วันนี้ลดราคา', 'ลดราคา', 'th', true],
    ['an absent word does not match', 'quiet text', 'loud', 'en', false],
    ['an unknown language tag still matches', 'Big sale', 'sale', 'not a tag!', true],
  ])('%s', (_label, textValue, entry, language, expected) => {
    expect(matches(textValue, entry, language)).toBe(expected)
  })
})

describe('cleanList (A-152)', () => {
  it.each([
    ['absent', undefined, []],
    ['empty', [], []],
    ['only blank entries', ['', '  '], []],
    ['entries trimmed and blanks dropped', [' zib ', '', 'quor'], ['zib', 'quor']],
  ])('%s', (_label, list, expected) => {
    expect(cleanList(list)).toEqual(expected)
  })
})
