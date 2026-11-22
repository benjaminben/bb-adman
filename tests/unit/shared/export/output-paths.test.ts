// P8-2 (spec/export-and-checks.md "Output layout", spec/phases/phase-08.md "Output layout
// additions", review-leftovers LP-3): the export's file names. Every part built from a
// project-file value is checked against a strict pattern; a bad one throws exactly "Storage
// path refused" and gives no path.
import { describe, it, expect } from 'vitest'
import { adPath, reportNames, reportStamp, type AdFile } from '@/shared/export/output-paths'
import { REFUSED_PATH, storageFilePath } from '@/main/providers/storage-paths'

const AD: AdFile = {
  campaignId: 'spring-sale-abc234',
  title: 'Summer sale!',
  sizeLabel: '9x16',
  language: 'en-GB',
  variantId: 'k3f9q2',
  ext: 'png',
}

describe('adPath [P8-2, spec/export-and-checks.md "Output layout"]', () => {
  it('builds {campaignId}/{postTitle}/{sizeLabel}/{language}-{variantId}.{ext}', () => {
    expect(adPath(AD)).toBe('spring-sale-abc234/Summer sale-/9x16/en-GB-k3f9q2.png')
    expect(adPath({ ...AD, ext: 'mp4', language: 'fr' })).toBe(
      'spring-sale-abc234/Summer sale-/9x16/fr-k3f9q2.mp4',
    )
    expect(adPath({ ...AD, title: 'CON', ext: 'jpg' })).toBe(
      'spring-sale-abc234/post-CON/9x16/en-GB-k3f9q2.jpg',
    )
  })

  it('gives a path that passes the storage path rules', () => {
    const path = adPath({ ...AD, title: '../  Été . ' })
    expect(storageFilePath(path)).toBe(path)
  })

  const BAD: Array<[string, Partial<AdFile>]> = [
    ['a language with ..', { language: '../x' }],
    ['a language with /', { language: 'a/b' }],
    ['a language with a dot', { language: 'en.GB' }],
    ['an empty language', { language: '' }],
    ['a language with a space', { language: 'en GB' }],
    ['a size label that is not WxH', { sizeLabel: '../1x1' }],
    ['a size label with a zero side', { sizeLabel: '0x16' }],
    ['a campaign ID with /', { campaignId: 'a/spring-sale-abc234' }],
    ['a campaign ID with ..', { campaignId: '..' }],
    ['a campaign ID in capitals', { campaignId: 'Spring-sale-abc234' }],
    ['a variant ID with ..', { variantId: '..' }],
    ['a variant ID of the wrong length', { variantId: 'k3f9q' }],
    ['an extension not listed', { ext: 'html' as AdFile['ext'] }],
  ]

  it.each(BAD)('refuses %s with "Storage path refused"', (_name, change) => {
    expect(() => adPath({ ...AD, ...change })).toThrow(new Error(REFUSED_PATH))
  })
})

describe('reportStamp [P8-2]', () => {
  it('writes the local time as YYYYMMDD-HHmmss', () => {
    expect(reportStamp(new Date(2026, 0, 5, 7, 8, 9))).toBe('20260105-070809')
    expect(reportStamp(new Date(2026, 11, 31, 23, 59, 59))).toBe('20261231-235959')
  })
})

describe('reportNames [P8-2, A-193]', () => {
  const stamp = '20260105-070809'

  it('gives report-{stamp}.html and .json for the first try', () => {
    expect(reportNames(stamp, 1)).toEqual({
      html: 'report-20260105-070809.html',
      json: 'report-20260105-070809.json',
    })
  })

  it('gives -2 to -99 for the next tries', () => {
    expect(reportNames(stamp, 2)).toEqual({
      html: 'report-20260105-070809-2.html',
      json: 'report-20260105-070809-2.json',
    })
    expect(reportNames(stamp, 99)?.html).toBe('report-20260105-070809-99.html')
  })

  it('gives none past -99 or before the first try', () => {
    expect(reportNames(stamp, 100)).toBeNull()
    expect(reportNames(stamp, 0)).toBeNull()
    expect(reportNames(stamp, 1.5)).toBeNull()
  })

  it('refuses a stamp that is not YYYYMMDD-HHmmss', () => {
    expect(() => reportNames('../x', 1)).toThrow(new Error(REFUSED_PATH))
  })
})
