// spec/app-style-parts.md, "Swatch field" (D-109): the colour maths of the app's own picker,
// hex to and from hue (0 to 360), saturation and brightness (0 to 100), is pure.
import { describe, expect, it } from 'vitest'
import { hexToHsb, hsbToHex } from '@/renderer/ui/swatch-field/colour-maths'

describe('colour maths [D-109]', () => {
  it.each([
    ['#000000', { h: 0, s: 0, b: 0 }],
    ['#FFFFFF', { h: 0, s: 0, b: 100 }],
    ['#FF0000', { h: 0, s: 100, b: 100 }],
    ['#00FF00', { h: 120, s: 100, b: 100 }],
    ['#0000FF', { h: 240, s: 100, b: 100 }],
  ])('reads %s as its hue, saturation and brightness', (hex, hsb) => {
    expect(hexToHsb(hex)).toEqual(hsb)
  })

  it('reads lower-case hex the same as upper-case', () => {
    expect(hexToHsb('#e85d3f')).toEqual(hexToHsb('#E85D3F'))
  })

  it.each(['#000000', '#FFFFFF', '#FF0000', '#E85D3F', '#1A2B3C', '#808080', '#336699'])(
    'turns %s into hue, saturation and brightness and back, unchanged',
    (hex) => {
      expect(hsbToHex(hexToHsb(hex))).toBe(hex)
    },
  )

  it('writes an upper-case #rrggbb', () => {
    expect(hsbToHex({ h: 210, s: 50, b: 60 })).toBe('#4D7399')
    expect(hsbToHex({ h: 60, s: 100, b: 100 })).toBe('#FFFF00')
  })

  it('treats a hue of 360 as 0 and holds values to their range', () => {
    expect(hsbToHex({ h: 360, s: 100, b: 100 })).toBe('#FF0000')
    expect(hsbToHex({ h: -10, s: 140, b: -5 })).toBe('#000000')
    expect(hsbToHex({ h: 0, s: -20, b: 120 })).toBe('#FFFFFF')
  })
})
