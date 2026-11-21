// spec/starter-layouts.md "The starting font size": the largest whole size, from the rule's
// largest down to the smallest, at which the copy's estimated lines fit the box's content area.
// Pure, with no measuring, so the main process and the window give the same number.
import { FONT_ESTIMATE } from '@/shared/config/default-layout'

export type FontSizeRule = {
  fontSizeOfSmaller: number
  lineHeight: number
  letterSpacing: number // em
  allCaps: boolean
  padding: number // px
  outline: number // px
}

const WIDE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u
const SPACE = /\s/u

// One paragraph's width in em, and its longest word's: a run of letters with no space and no
// wide letter.
function paragraphEms(text: string, rule: FontSizeRule): { ems: number; word: number } {
  const narrow = rule.allCaps ? FONT_ESTIMATE.capital : FONT_ESTIMATE.letter
  let ems = 0
  let run = 0
  let word = 0
  for (const c of text) {
    const wide = WIDE.test(c)
    const em = (wide ? FONT_ESTIMATE.wide : narrow) + rule.letterSpacing
    ems += em
    run = wide || SPACE.test(c) ? 0 : run + em
    word = Math.max(word, run)
  }
  return { ems, word }
}

export function startingFontSize(
  copy: string | null,
  box: { width: number; height: number },
  rule: FontSizeRule,
  frame: { S: number },
): number {
  const max = Math.round(rule.fontSizeOfSmaller * frame.S)
  const min = Math.max(1, Math.round(FONT_ESTIMATE.smallestOfSmaller * frame.S))
  const text = (copy ?? '').trim()
  if (text === '') return max
  const inset = 2 * (rule.padding + rule.outline)
  const wc = box.width - inset
  const hc = box.height - inset
  if (wc <= 0 || hc <= 0) return min
  const paragraphs = text.split(/\r?\n/).map((p) => paragraphEms(p, rule))
  const word = Math.max(...paragraphs.map((p) => p.word))
  const fits = (f: number) => {
    const lines = paragraphs.reduce(
      (sum, p) => sum + Math.max(1, Math.ceil((f * p.ems) / (FONT_ESTIMATE.lineFill * wc))),
      0,
    )
    return lines * rule.lineHeight * f <= hc && word * f <= wc
  }
  for (let f = max; f >= min; f -= 1) if (fits(f)) return f
  return min
}
