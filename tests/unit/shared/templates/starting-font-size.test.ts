import { describe, it, expect } from 'vitest'
import { startingFontSize, type FontSizeRule } from '@/shared/templates/starting-font-size'

// Plain words of 8 letters and a space, cut to `n` letters; every n used ends on a letter.
const words = (n: number) => 'abcdefgh '.repeat(Math.ceil(n / 9)).slice(0, n)

const HEADLINE: FontSizeRule = {
  fontSizeOfSmaller: 0.075,
  lineHeight: 1.1,
  letterSpacing: 0,
  allCaps: false,
  padding: 0,
  outline: 0,
}
const BUTTON: FontSizeRule = {
  fontSizeOfSmaller: 0.035,
  lineHeight: 1.2,
  letterSpacing: 0.02,
  allCaps: false,
  padding: 16,
  outline: 3,
}
const S1080 = { S: 1080 }
const SQUARE_BOX = { width: 950, height: 238 }
const TALL_BOX = { width: 950, height: 422 }

describe('startingFontSize: the worked values [spec/starter-layouts.md]', () => {
  it.each([
    [11, 81, 81],
    [60, 71, 81],
    [120, 47, 63],
    [300, 30, 42],
    [1000, 22, 22],
  ])('a headline of %i letters gives %i at 1080x1080 and %i at 1080x1920', (n, square, tall) => {
    const copy = words(n)
    expect(copy).toHaveLength(n)
    expect(startingFontSize(copy, SQUARE_BOX, HEADLINE, S1080)).toBe(square)
    expect(startingFontSize(copy, TALL_BOX, HEADLINE, S1080)).toBe(tall)
  })

  it.each([
    ['Shop now', 38],
    [words(40), 24],
  ])('the button of layout 1 at 1080x1080 gives "%s" size %i', (copy, size) => {
    expect(startingFontSize(copy, { width: 454, height: 97 }, BUTTON, S1080)).toBe(size)
  })
})

describe('startingFontSize: other cases [spec/starter-layouts.md]', () => {
  it.each([[''], ['   '], [null]])('gives the largest size for an empty copy %o', (copy) => {
    expect(startingFontSize(copy, SQUARE_BOX, HEADLINE, S1080)).toBe(81)
  })

  it('counts the lines of both paragraphs of a copy with a line break', () => {
    const box = { width: 950, height: 100 }
    expect(startingFontSize('Hello World', box, HEADLINE, S1080)).toBe(81)
    expect(startingFontSize('Hello\nWorld', box, HEADLINE, S1080)).toBe(45)
  })

  it('counts a Japanese letter as 1 em wide and finds no long word in it', () => {
    expect(startingFontSize('漢'.repeat(50), SQUARE_BOX, HEADLINE, S1080)).toBe(54)
  })

  it('keeps the longest word inside the width, wider in all capitals', () => {
    const word = 'a'.repeat(30)
    expect(startingFontSize(word, SQUARE_BOX, HEADLINE, S1080)).toBe(52)
    expect(startingFontSize(word, SQUARE_BOX, { ...HEADLINE, allCaps: true }, S1080)).toBe(45)
  })

  it.each([
    ['no width left', { width: 20, height: 238 }],
    ['no height left', { width: 950, height: 20 }],
  ])('gives the smallest size when the content area has %s', (_, box) => {
    const rule = { ...HEADLINE, padding: 8, outline: 2 }
    expect(startingFontSize('Hi', box, rule, S1080)).toBe(22)
  })

  it('never gives less than 1 for the smallest size', () => {
    expect(startingFontSize(words(300), { width: 40, height: 10 }, HEADLINE, { S: 20 })).toBe(1)
  })
})
