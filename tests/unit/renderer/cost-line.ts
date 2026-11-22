// DLG-4a: finds a cost line (MoneyLine) by its words. The line draws its arrow as a hidden
// icon followed by a hidden "to", so its text is the words with " → " read as " to ".
import type { MatcherFunction } from '@testing-library/react'

export const spoken = (words: string) => words.replace(' → ', ' to ')

export function costLine(words: string): MatcherFunction {
  return (_content, element) => element?.tagName === 'P' && element.textContent === spoken(words)
}
