// LK-1 (security class): rgbCss is the only way a look colour becomes CSS. It builds the CSS from
// three whole numbers read out of an exact #RRGGBB value, so no caller's text reaches the style.
import { describe, it, expect } from 'vitest'
import { rgbCss } from '@/shared/scene/colour-css'

describe('rgbCss [LK-1]', () => {
  it('turns #RRGGBB into rgb(R G B)', () => {
    expect(rgbCss('#1A2B3C')).toBe('rgb(26 43 60)')
    expect(rgbCss('#ffffff')).toBe('rgb(255 255 255)')
    expect(rgbCss('#000000')).toBe('rgb(0 0 0)')
  })

  it.each<[number, string]>([
    [0.5, 'rgb(26 43 60 / 0.5)'],
    [1, 'rgb(26 43 60 / 1)'],
    [0, 'rgb(26 43 60 / 0)'],
    [1.5, 'rgb(26 43 60 / 1)'],
    [-2, 'rgb(26 43 60 / 0)'],
    [0.123456, 'rgb(26 43 60 / 0.1235)'],
    [1 / 3, 'rgb(26 43 60 / 0.3333)'],
    [1e-7, 'rgb(26 43 60 / 0)'],
  ])('writes alpha %s clamped to 0..1 with at most 4 decimals', (alpha, css) => {
    expect(rgbCss('#1A2B3C', alpha)).toBe(css)
  })

  it.each([
    'red',
    '#FFF',
    '#12345G',
    'url(x)',
    '#123456;',
    '#123456; background: url(x)',
    ' #123456',
    '#1234567',
    '',
  ])('gives null for %j', (value) => {
    expect(rgbCss(value)).toBeNull()
  })

  it('gives null for a value that is not a string, or a colour with an alpha that is not finite', () => {
    expect(rgbCss(null)).toBeNull()
    expect(rgbCss(undefined)).toBeNull()
    expect(rgbCss(123 as unknown as string)).toBeNull()
    expect(rgbCss('#1A2B3C', NaN)).toBeNull()
    expect(rgbCss('#1A2B3C', Infinity)).toBeNull()
  })
})
