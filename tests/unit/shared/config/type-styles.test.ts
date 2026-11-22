// R2E-3 (spec/phases/round-2-editor.md D3): five built-in type styles made from Inter alone,
// the one font the app bundles. A style sets weight, capitals and spacing, never a font file.
import { describe, it, expect } from 'vitest'
import {
  TYPE_STYLES,
  TYPE_STYLE_IDS,
  isTypeStyleId,
  typeStyleOf,
  typeStylePatch,
  typeStylePrompt,
} from '@/shared/config/type-styles'

describe('TYPE_STYLES [R2E-3, D3]', () => {
  it('lists the five styles of the plan, in its order', () => {
    expect(
      TYPE_STYLES.map((s) => [s.id, s.label, s.fontWeight, s.allCaps, s.letterSpacing]),
    ).toEqual([
      ['regular', 'Regular', 400, false, 0],
      ['bold', 'Bold', 700, false, 0],
      ['black-caps', 'Black capitals', 900, true, 0.02],
      ['light', 'Light', 300, false, 0],
      ['spaced-caps', 'Spaced capitals', 500, true, 0.12],
    ])
    expect(TYPE_STYLE_IDS).toEqual(TYPE_STYLES.map((s) => s.id))
  })

  it("keeps every weight inside Inter's range, 100 to 900", () => {
    for (const s of TYPE_STYLES) {
      expect(s.fontWeight).toBeGreaterThanOrEqual(100)
      expect(s.fontWeight).toBeLessThanOrEqual(900)
    }
  })

  it('knows only its own five ids', () => {
    expect(TYPE_STYLE_IDS.every(isTypeStyleId)).toBe(true)
    for (const bad of ['Bold', 'heavy', '', null, 7, undefined])
      expect(isTypeStyleId(bad)).toBe(false)
  })

  it('patches the three fields and puts the font back to the default', () => {
    expect(typeStylePatch('black-caps')).toEqual({
      fontAssetId: null,
      fontWeight: 900,
      allCaps: true,
      letterSpacing: 0.02,
    })
  })

  it('finds the style whose three fields match a text style, treating no allCaps as off', () => {
    expect(typeStyleOf({ fontWeight: 700, letterSpacing: 0 })).toBe('bold')
    expect(typeStyleOf({ fontWeight: 500, allCaps: true, letterSpacing: 0.12 })).toBe('spaced-caps')
    expect(typeStyleOf({ fontWeight: 500, allCaps: false, letterSpacing: 0.12 })).toBeNull()
    expect(typeStyleOf({ fontWeight: 600, letterSpacing: 0 })).toBeNull()
  })

  it('gives the prompt each id with words that name only Inter and the look', () => {
    expect(typeStylePrompt()).toEqual([
      { id: 'regular', words: 'Regular: Inter at weight 400' },
      { id: 'bold', words: 'Bold: Inter at weight 700' },
      {
        id: 'black-caps',
        words: 'Black capitals: Inter at weight 900, in capitals, spaced 0.02 em',
      },
      { id: 'light', words: 'Light: Inter at weight 300' },
      {
        id: 'spaced-caps',
        words: 'Spaced capitals: Inter at weight 500, in capitals, spaced 0.12 em',
      },
    ])
  })
})
