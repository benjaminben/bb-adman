// P6-1 (spec/phases/phase-06.md, design addition 2, "Status on new layers").
import { describe, it, expect } from 'vitest'
import { initialTranslation } from '@/shared/translation/initial'

const MISSING = { translationStatus: 'missing', translationSource: null }
const NONE = { translationStatus: null, translationSource: null }

describe('initialTranslation [P6-1]', () => {
  it.each([
    ['a text layer in another language', 'de', 'en', 'text', MISSING],
    ['a text layer in Japanese', 'ja', 'en', 'text', MISSING],
    ['a text layer in the main language', 'en', 'en', 'text', NONE],
    ['a picture layer in another language', 'de', 'en', 'image', NONE],
    ['a background layer in another language', 'de', 'en', 'background', NONE],
  ] as const)('gives %s', (_name, language, primary, type, expected) => {
    expect(initialTranslation(language, primary, type)).toEqual(expected)
  })
})
