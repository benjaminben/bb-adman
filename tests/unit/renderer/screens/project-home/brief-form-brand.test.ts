import { describe, it, expect } from 'vitest'
import {
  brandFromDraft,
  brandPlan,
  removedBrandAssets,
  type BriefBrand,
} from '@/renderer/screens/project-home/brief-form-brand'
import { formFromDraft, planFromForm } from '@/renderer/screens/project-home/brief-form-model'
import { DEFAULT_STARTER_LAYOUT_ID } from '@/shared/config/starter-layouts'
import type { BriefDraft } from '@/shared/schemas/brief'
import { IMAGES, photosFor } from './brief-photo-fixture'
import { DRAFT } from './project-fixture'

const IMPORTED: BriefBrand = {
  logo: { assetId: 'L1', added: true },
  headingFont: { assetId: 'F1', added: true },
  bodyFont: { assetId: 'F2', added: false },
  notes: ['The text font "Body.woff2" could not be read.'],
}

const FULL: BriefDraft = {
  brand: { colours: ['#0b3d2e', ' #FFF6E5 '], logo: 'brand/logo.png' },
  layout: ' Flat-Centre-Top ',
  artDirection: '  Calm space lower left  ',
  adsPer: 'SUBJECT',
}

describe('brandFromDraft: the brand part of the form [spec/brief-brand.md, "The brief form"]', () => {
  it('takes the files from the import and the rest from the draft, cleaned', () => {
    expect(brandFromDraft(FULL, IMPORTED)).toEqual({
      logo: { assetId: 'L1', added: true },
      headingFont: { assetId: 'F1', added: true },
      bodyFont: { assetId: 'F2', added: false },
      colours: ['#0B3D2E', '#FFF6E5'],
      layoutId: 'flat-centre-top',
      artDirection: 'Calm space lower left',
      notes: ['The text font "Body.woff2" could not be read.'],
    })
  })

  it('gives the default layout and no brand for a draft with none', () => {
    expect(brandFromDraft({})).toEqual({
      logo: null,
      headingFont: null,
      bodyFont: null,
      colours: [],
      layoutId: DEFAULT_STARTER_LAYOUT_ID,
      artDirection: '',
      notes: [],
    })
  })

  it('lists the import notes first, then a line per bad value, colours, layout, ad sets', () => {
    const draft: BriefDraft = {
      brand: { colours: ['teal', '#12345', '', '#0b3'] },
      layout: 'nope',
      adsPer: 'banana',
    }
    const brand = brandFromDraft(draft, { ...IMPORTED, notes: ['Import note.'] })
    expect(brand.colours).toEqual(['#00BB33'])
    expect(brand.layoutId).toBe(DEFAULT_STARTER_LAYOUT_ID)
    expect(brand.notes).toEqual([
      'Import note.',
      'The colour "teal" is not a hex colour such as #0B3D2E.',
      'The colour "#12345" is not a hex colour such as #0B3D2E.',
      'The layout "nope" is not one of Adman\'s starting layouts. The default is used.',
      'Ad sets "banana" is not "campaign" or "subject". All subjects share one set.',
    ])
  })

  it('counts a blank layout as none, with no note', () => {
    const brand = brandFromDraft({ layout: '   ' })
    expect(brand.layoutId).toBe(DEFAULT_STARTER_LAYOUT_ID)
    expect(brand.notes).toEqual([])
  })
})

describe('formFromDraft: the brand fields of the form', () => {
  it('fills brand and adsPer from the draft and the imported files', () => {
    const values = formFromDraft({ draft: FULL, primaryLanguage: 'en' }, [], [], IMPORTED)
    expect(values.brand).toEqual(brandFromDraft(FULL, IMPORTED))
    expect(values.adsPer).toBe('subject')
  })

  it('opens empty with the default layout, no brand and one set of ads', () => {
    const values = formFromDraft(null, [])
    expect(values.brand).toEqual(brandFromDraft({}))
    expect(values.adsPer).toBe('campaign')
  })
})

describe('brandPlan: what the brand adds to campaign.create', () => {
  const none = brandFromDraft({})

  it('sends nothing for a form with no brand choices', () => {
    expect(brandPlan(none)).toEqual({ brief: {}, campaign: undefined })
  })

  it('sends a layout other than the default, the art direction trimmed and the colours', () => {
    const brand = {
      ...none,
      layoutId: 'photo-label-box',
      artDirection: ' Soft light ',
      colours: ['#0B3D2E'],
    }
    expect(brandPlan(brand).brief).toEqual({
      layout: 'photo-label-box',
      artDirection: 'Soft light',
      brand: { colours: ['#0B3D2E'] },
    })
  })

  it('leaves out a blank art direction', () => {
    expect(brandPlan({ ...none, artDirection: '  \n ' }).brief).toEqual({})
  })

  it('sends each asset ID the form holds, and leaves out the rest', () => {
    expect(brandPlan(brandFromDraft({}, IMPORTED)).campaign).toEqual({
      logoAssetId: 'L1',
      headingFontAssetId: 'F1',
      bodyFontAssetId: 'F2',
    })
    const logoOnly = { ...none, logo: { assetId: 'L1', added: false } }
    expect(brandPlan(logoOnly).campaign).toEqual({ logoAssetId: 'L1' })
  })
})

describe('planFromForm: the brand in "Create campaign"', () => {
  const filled = (draft: BriefDraft, imported?: BriefBrand) =>
    formFromDraft({ draft, primaryLanguage: 'en' }, [], photosFor(draft), imported)

  it('sends layout, art direction, ad sets, colours and the brand IDs', () => {
    const result = planFromForm('P1', filled({ ...DRAFT, ...FULL }, IMPORTED), [], IMAGES)
    if (!result.ok) throw new Error(result.problems.join())
    expect(result.campaign.brief).toMatchObject({
      layout: 'flat-centre-top',
      artDirection: 'Calm space lower left',
      adsPer: 'subject',
      brand: { colours: ['#0B3D2E', '#FFF6E5'] },
    })
    expect(result.campaign.brand).toEqual({
      logoAssetId: 'L1',
      headingFontAssetId: 'F1',
      bodyFontAssetId: 'F2',
    })
  })

  it('adds no brand key for a form with no brand choices', () => {
    const result = planFromForm('P1', filled(DRAFT), [], IMAGES)
    if (!result.ok) throw new Error(result.problems.join())
    expect(result.campaign.brief).not.toHaveProperty('layout')
    expect(result.campaign.brief).not.toHaveProperty('artDirection')
    expect(result.campaign.brief).not.toHaveProperty('adsPer')
    expect(result.campaign.brief).not.toHaveProperty('brand')
    expect(result.campaign).not.toHaveProperty('brand')
  })

  it('adds no problem line for the brand', () => {
    const values = filled({ ...DRAFT, brand: { colours: ['teal'] }, layout: 'nope' })
    expect(planFromForm('P1', values, [], IMAGES).ok).toBe(true)
  })
})

describe('removedBrandAssets: what Remove and Cancel send asset.remove for', () => {
  const form = (imported: BriefBrand, photoIds: string[] = []) => {
    const values = formFromDraft({ draft: DRAFT, primaryLanguage: 'en' }, [], [], imported)
    values.subjects[0] = {
      ...values.subjects[0]!,
      photos: photoIds.map((assetId) => ({ assetId, added: true })),
    }
    return values
  }

  it('gives an added asset of a role that leaves', () => {
    expect(removedBrandAssets(form(IMPORTED), ['logo'])).toEqual(['L1'])
  })

  it('keeps an asset the form did not add', () => {
    expect(removedBrandAssets(form(IMPORTED), ['bodyFont'])).toEqual([])
  })

  it('keeps an asset another brand role still holds', () => {
    const shared = { ...IMPORTED, bodyFont: { assetId: 'F1', added: true } }
    expect(removedBrandAssets(form(shared), ['headingFont'])).toEqual([])
  })

  it('keeps an asset a subject photo holds', () => {
    expect(removedBrandAssets(form(IMPORTED, ['L1']), ['logo'])).toEqual([])
  })

  it('gives a shared added asset once when every role holding it leaves', () => {
    const shared = { ...IMPORTED, bodyFont: { assetId: 'F1', added: true } }
    expect(removedBrandAssets(form(shared), ['logo', 'headingFont', 'bodyFont'])).toEqual([
      'L1',
      'F1',
    ])
  })

  it('gives nothing for a role with no file', () => {
    const empty = { ...IMPORTED, logo: null }
    expect(removedBrandAssets(form(empty), ['logo'])).toEqual([])
  })
})
