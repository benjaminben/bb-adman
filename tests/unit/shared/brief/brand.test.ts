import { describe, it, expect } from 'vitest'
import {
  adsPerOf,
  artDirectionOf,
  brandColours,
  brandFileTexts,
  briefLayoutId,
  briefLook,
} from '@/shared/brief/brand'
import type { BriefDraft } from '@/shared/schemas/brief'

// spec/brief-brand.md "The rules" and "Shared helpers" [A-400].
describe('brandColours [spec/brief-brand.md "The rules"]', () => {
  it('keeps a 6-digit colour in upper case', () => {
    expect(brandColours(['#0b3d2e'])).toEqual({ colours: ['#0B3D2E'], notes: [] })
  })

  it('widens a 3-digit colour by doubling each digit', () => {
    expect(brandColours(['#0b3'])).toEqual({ colours: ['#00BB33'], notes: [] })
  })

  it('trims a colour before reading it', () => {
    expect(brandColours([' #FFF6E5 '])).toEqual({ colours: ['#FFF6E5'], notes: [] })
  })

  it.each(['teal', '#12345', '0B3D2E'])('gives a note with the raw text for %s', (text) => {
    expect(brandColours([text])).toEqual({
      colours: [],
      notes: [{ field: 'colours', text, reason: 'not_a_colour' }],
    })
  })

  it('skips a blank text with no note', () => {
    expect(brandColours(['', '  ', '#0B3D2E'])).toEqual({ colours: ['#0B3D2E'], notes: [] })
  })

  it('keeps a colour repeated in another case once, in brief order', () => {
    const got = brandColours(['#fff6e5', '#0B3D2E', '#FFF6E5', '#0b3d2e'])
    expect(got.colours).toEqual(['#FFF6E5', '#0B3D2E'])
  })

  it('reads one text as a list of one', () => {
    expect(brandColours('#0b3d2e')).toEqual({ colours: ['#0B3D2E'], notes: [] })
  })

  it('gives nothing for a missing list', () => {
    expect(brandColours(undefined)).toEqual({ colours: [], notes: [] })
  })
})

describe('briefLayoutId [spec/brief-brand.md "The rules"]', () => {
  it.each([
    'photo-bottom-left',
    'photo-top-centre',
    'flat-bottom-left',
    'flat-centre-top',
    'photo-label-box',
  ])('finds %s', (id) => {
    expect(briefLayoutId(id)).toEqual({ layoutId: id, notes: [] })
  })

  it('reads an ID without case or outer spaces', () => {
    expect(briefLayoutId(' Photo-Top-Centre ')).toEqual({
      layoutId: 'photo-top-centre',
      notes: [],
    })
  })

  it('gives a note and null for an unknown ID', () => {
    expect(briefLayoutId('nope')).toEqual({
      layoutId: null,
      notes: [{ field: 'layout', text: 'nope', reason: 'unknown_layout' }],
    })
  })

  it('gives null and no note when missing', () => {
    expect(briefLayoutId(undefined)).toEqual({ layoutId: null, notes: [] })
  })
})

describe('adsPerOf [spec/brief-brand.md "The rules"]', () => {
  it.each([
    ['subject', 'subject'],
    [' SUBJECT ', 'subject'],
    ['campaign', 'campaign'],
    [undefined, 'campaign'],
    ['', 'campaign'],
  ] as const)('reads %j as %s with no note', (raw, adsPer) => {
    expect(adsPerOf(raw)).toEqual({ adsPer, notes: [] })
  })

  it('reads any other text as campaign, with a note', () => {
    expect(adsPerOf('banana')).toEqual({
      adsPer: 'campaign',
      notes: [{ field: 'adsPer', text: 'banana', reason: 'unknown_ads_per' }],
    })
  })
})

describe('artDirectionOf [spec/brief-brand.md "The rules"]', () => {
  it('trims the text', () => {
    expect(artDirectionOf('  Soft morning light \n')).toBe('Soft morning light')
  })

  it.each([undefined, '', '  \n '])('gives null for %j', (raw) => {
    expect(artDirectionOf(raw)).toBeNull()
  })
})

describe('briefLook [spec/brief-brand.md "Shared helpers"]', () => {
  it('cleans every value and lists notes in the order colours, layout, adsPer', () => {
    const draft: BriefDraft = {
      adsPer: 'banana',
      layout: 'nope',
      artDirection: ' Calm space ',
      brand: { colours: ['#0b3', 'teal'] },
    }
    expect(briefLook(draft)).toEqual({
      colours: ['#00BB33'],
      layoutId: null,
      artDirection: 'Calm space',
      adsPer: 'campaign',
      notes: [
        { field: 'colours', text: 'teal', reason: 'not_a_colour' },
        { field: 'layout', text: 'nope', reason: 'unknown_layout' },
        { field: 'adsPer', text: 'banana', reason: 'unknown_ads_per' },
      ],
    })
  })

  it('gives the defaults for an empty draft', () => {
    expect(briefLook({})).toEqual({
      colours: [],
      layoutId: null,
      artDirection: null,
      adsPer: 'campaign',
      notes: [],
    })
  })
})

describe('brandFileTexts [spec/brief-brand.md "Shared helpers"]', () => {
  it('gives the logo and font texts as given, in role order', () => {
    const draft: BriefDraft = {
      brand: { fonts: { body: ' b.woff2', heading: 'h.otf' }, logo: 'brand/logo.png' },
    }
    expect(brandFileTexts(draft)).toEqual([
      { role: 'logo', text: 'brand/logo.png' },
      { role: 'headingFont', text: 'h.otf' },
      { role: 'bodyFont', text: ' b.woff2' },
    ])
  })

  it('leaves out absent roles', () => {
    expect(brandFileTexts({ brand: { fonts: { body: 'b.ttf' } } })).toEqual([
      { role: 'bodyFont', text: 'b.ttf' },
    ])
    expect(brandFileTexts({ brand: { colours: '#FFFFFF' } })).toEqual([])
    expect(brandFileTexts({})).toEqual([])
  })
})
