import { describe, expect, it } from 'vitest'
import { textCss } from '@/shared/scene/text-style'
import { textStyle } from './fixtures'

describe('textCss [FR-093, FR-249]', () => {
  it('gives exactly the property list of spec/scene.md "Text layers" and no other', () => {
    expect(textCss(textStyle)).toEqual({
      fontFamily: '"adman-default"',
      fontSize: '40px',
      fontWeight: 700,
      fontStyle: 'normal',
      fontSynthesis: 'none',
      color: '#112233',
      textAlign: 'center',
      lineHeight: 1.2,
      letterSpacing: '0.05em',
      whiteSpace: 'pre-wrap',
      overflowWrap: 'normal',
      wordBreak: 'normal',
      hyphens: 'manual',
      fontKerning: 'normal',
      overflow: 'visible',
      padding: 0,
      margin: 0,
      boxSizing: 'border-box',
    })
  })

  it.each([
    { letterSpacing: -0.2, want: '-0.2em' },
    { letterSpacing: 0, want: '0em' },
    { letterSpacing: 1, want: '1em' },
  ])('draws letter spacing $letterSpacing in em', ({ letterSpacing, want }) => {
    expect(textCss({ ...textStyle, letterSpacing }).letterSpacing).toBe(want)
  })

  it('names the uploaded font first and the bundled font as the fallback', () => {
    expect(textCss({ ...textStyle, fontAssetId: 'F1' }).fontFamily).toBe(
      '"adman-font-F1", "adman-default"',
    )
  })
})
