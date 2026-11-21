import { describe, it, expect } from 'vitest'
import { wordsByLanguage } from '@/shared/brief/words'

describe('wordsByLanguage [SPEC 6.1, 14 slice B, R-03]', () => {
  it('stores a plain word list under the primary language', () => {
    expect(wordsByLanguage(['Sale', 'Free'], 'de')).toEqual({ de: ['Sale', 'Free'] })
  })

  it('keeps a list given per language as it is', () => {
    const words = { en: ['Sale'], fr: ['Solde', 'Gratuit'] }
    expect(wordsByLanguage(words, 'de')).toEqual({ en: ['Sale'], fr: ['Solde', 'Gratuit'] })
  })

  it('gives a new value that does not share lists with its input', () => {
    const plain = ['Sale']
    const perLanguage = { en: ['Sale'] }
    const fromPlain = wordsByLanguage(plain, 'en')
    const fromPerLanguage = wordsByLanguage(perLanguage, 'en')
    fromPlain.en?.push('Free')
    fromPerLanguage.en?.push('Free')
    expect(plain).toEqual(['Sale'])
    expect(perLanguage).toEqual({ en: ['Sale'] })
  })

  it('stores an empty plain list under the primary language', () => {
    expect(wordsByLanguage([], 'en')).toEqual({ en: [] })
  })
})
