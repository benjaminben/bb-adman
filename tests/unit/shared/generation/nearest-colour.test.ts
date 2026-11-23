import { describe, it, expect } from 'vitest'
import { nearestColour } from '@/shared/generation/nearest-colour'

describe('nearestColour [spec/brief-brand.md "Shared helpers"]', () => {
  it('gives the nearest of three palette colours', () => {
    const palette = ['#FF0000', '#00FF00', '#0000FF']
    expect(nearestColour('#10E020', palette)).toBe('#00FF00')
    expect(nearestColour('#2010C0', palette)).toBe('#0000FF')
    expect(nearestColour('#C02010', palette)).toBe('#FF0000')
  })

  it('measures by the sum of squared red, green and blue differences', () => {
    // #808080 is 3 x 128² from black and 3 x 127² from white: white is nearer.
    expect(nearestColour('#808080', ['#000000', '#FFFFFF'])).toBe('#FFFFFF')
  })

  it('keeps the first colour on a tie', () => {
    expect(nearestColour('#808080', ['#708080', '#908080'])).toBe('#708080')
    expect(nearestColour('#808080', ['#908080', '#708080'])).toBe('#908080')
  })

  it('gives the palette colour as the palette writes it', () => {
    expect(nearestColour('#FFFFFF', ['#fff6e5', '#0b3d2e'])).toBe('#fff6e5')
  })
})
