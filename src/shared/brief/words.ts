// SPEC 6.1 and R-03: a plain word list belongs to the primary language; a list given per
// language is kept as given. Pure: the result shares no list with its input.
import type { WordsByLanguageFn } from '../templates/types'

export const wordsByLanguage: WordsByLanguageFn = (words, primaryLanguage) => {
  if (Array.isArray(words)) return { [primaryLanguage]: [...words] }
  return Object.fromEntries(Object.entries(words).map(([tag, list]) => [tag, [...list]]))
}
