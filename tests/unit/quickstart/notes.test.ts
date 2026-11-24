import { describe, expect, it } from 'vitest'
import { fileNoteLine, lookNoteLine } from '../../../quickstart/notes'

describe('quickstart note lines', () => {
  it('names a missing or wrong file by its last part only', () => {
    expect(fileNoteLine('photo', '/Users/someone/private/can.png', 'not_found')).toBe(
      'The photo "can.png" was not found. It is left out.',
    )
    expect(fileNoteLine('logo', 'C:\\brand\\logo.gif', 'not_a_picture')).toBe(
      'The logo "logo.gif" is not a PNG, JPEG or WebP picture. It is left out.',
    )
    expect(fileNoteLine('headline font', 'brand/Head.txt', 'not_a_font')).toBe(
      'The headline font "Head.txt" is not a TTF, OTF or WOFF2 font. It is left out.',
    )
    expect(fileNoteLine('text font', 'brand/Body.woff2', 'not_readable')).toBe(
      'The text font "Body.woff2" could not be read. It is left out.',
    )
  })

  it('gives one line per brief value that cannot be used, its text cleaned', () => {
    expect(lookNoteLine({ field: 'colours', text: 'red\u202e', reason: 'not_a_colour' })).toBe(
      'The colour "red" is not a hex colour such as #0B3D2E.',
    )
    expect(lookNoteLine({ field: 'layout', text: 'zigzag', reason: 'unknown_layout' })).toBe(
      'The layout "zigzag" is not one of the starting layouts. The default is used.',
    )
    expect(lookNoteLine({ field: 'adsPer', text: 'each', reason: 'unknown_ads_per' })).toBe(
      'Ad sets "each" is not "campaign" or "subject". All subjects share one set.',
    )
  })
})
