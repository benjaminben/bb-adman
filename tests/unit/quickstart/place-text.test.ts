import { describe, expect, it } from 'vitest'
import { TYPE_STYLE_IDS, typeStylePrompt } from '@/shared/config/type-styles'
import { layoutOffer } from '../../../quickstart/place-text'

describe('quickstart layoutOffer', () => {
  it('offers the brand colours and the brand font names, and no type styles', () => {
    const offer = layoutOffer(['#0B3D2E', '#FFF6E5'], ['Archivo Black', 'Archivo', 'Archivo'])
    expect(offer.input).toEqual({
      palette: ['#0B3D2E', '#FFF6E5'],
      fonts: ['Inter', 'Archivo Black', 'Archivo'],
    })
    expect(offer.typeStyles).toBeUndefined()
  })

  it('offers the built-in type styles when the brief gives no font', () => {
    const offer = layoutOffer([], [])
    expect(offer.input).toEqual({ palette: [], fonts: ['Inter'], typeStyles: typeStylePrompt() })
    expect(offer.typeStyles).toEqual(TYPE_STYLE_IDS)
  })
})
