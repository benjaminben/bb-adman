import { describe, it, expect } from 'vitest'
import { primaryLanguageOf } from '@/shared/brief/primary-language'

describe('primaryLanguageOf [spec/brief-and-templates.md "The brief.parse command"]', () => {
  it.each([
    ['the first language listed', { languages: ['fr', 'en'], region: 'US' }, 'fr'],
    ['the first language with no region', { languages: ['de'] }, 'de'],
    ['the region language when no language is listed', { region: 'Germany' }, 'de'],
    ['the region language when the list is empty', { languages: [], region: 'JP' }, 'ja'],
    ['null for a region not in the table', { region: 'Atlantis' }, null],
    ['null with neither field', {}, null],
    ['null for an empty region', { region: '' }, null],
  ])('gives %s', (_case, draft, language) => {
    expect(primaryLanguageOf(draft)).toBe(language)
  })
})
