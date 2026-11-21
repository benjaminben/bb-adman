// AP-7 (spec/approvals.md "Pictures"): the one owner of picture paths. Every part is checked
// before use; a failure throws exactly "Storage path refused" and gives no path.
import { describe, it, expect } from 'vitest'
import {
  pictureFolder,
  picturePath,
  pictureFolderOf,
  checkPictureFolder,
  picturesIn,
  checkPictureLifetime,
  removalFolder,
  PICTURE_URL_MAX_SECONDS,
  REFUSED_LIFETIME,
} from '@/shared/approvals/picture-paths'
import { REFUSED_PATH } from '@/main/providers/storage-paths'
import * as signing from '@/main/providers/s3/signed-url'

const P = '01JD5Z8Q4N3V6W7X8Y9Z0ABCDE'
const C = 'spring-sale-abc234'
const V = 'k3f9q2'
const FOLDER = `adman-approvals/${P}/${C}/`

describe('picture path shapes [spec/approvals.md "Pictures"]', () => {
  it('builds the folder adman-approvals/{projectId}/{campaignId}/', () => {
    expect(pictureFolder(P, C)).toBe(FOLDER)
  })

  it('builds the file {folder}{variantId}-{rev}.png', () => {
    expect(picturePath(P, C, V, 7)).toBe(`${FOLDER}${V}-7.png`)
    expect(picturePath(P, C, V, 0)).toBe(`${FOLDER}${V}-0.png`)
  })

  it('gives the folder of a picture file and takes the folder itself', () => {
    expect(pictureFolderOf(`${FOLDER}${V}-12.png`)).toBe(FOLDER)
    expect(checkPictureFolder(FOLDER)).toBe(FOLDER)
  })

  it('uses the same refusal words as the storage path rules', () => {
    expect(REFUSED_PATH).toBe('Storage path refused')
  })
})

const BAD_IDS = ['', '.', '..', '/', 'a/b', '..\\x', '%2e%2e', '%2F', ' ', 'x\u0000']

type BadParts = [string, string, string, string, number]

describe('picture path parts refused [spec/approvals.md "Pictures"]', () => {
  it.each<BadParts>([
    ...BAD_IDS.map((bad) => ['project', bad, C, V, 1] as BadParts),
    ['project in lower case', P.toLowerCase(), C, V, 1],
    ['project too short', P.slice(1), C, V, 1],
    ['project with U', `U${P.slice(1)}`, C, V, 1],
    ...BAD_IDS.map((bad) => ['campaign', P, bad, V, 1] as BadParts),
    ['campaign in upper case', P, C.toUpperCase(), V, 1],
    ['campaign without code', P, 'spring-sale', V, 1],
    ['campaign with dots', P, 'spring..sale-abc234', V, 1],
    ...BAD_IDS.map((bad) => ['variant', P, C, bad, 1] as BadParts),
    ['variant too long', P, C, 'k3f9q2a', 1],
    ['variant with 1', P, C, 'k3f9q1', 1],
    ['variant with a dash', P, C, 'k3f-q2', 1],
    ['rev negative', P, C, V, -1],
    ['rev fraction', P, C, V, 1.5],
    ['rev not a number', P, C, V, Number.NaN],
    ['rev infinite', P, C, V, Number.POSITIVE_INFINITY],
    ['rev too large', P, C, V, Number.MAX_SAFE_INTEGER + 1],
  ])('refuses a bad %s (%j)', (what, projectId, campaignId, variantId, rev) => {
    expect(() => picturePath(projectId, campaignId, variantId, rev)).toThrow(
      new Error(REFUSED_PATH),
    )
    if (what.startsWith('project') || what.startsWith('campaign')) {
      expect(() => pictureFolder(projectId, campaignId)).toThrow(new Error(REFUSED_PATH))
    }
  })
})

const NOT_PICTURE_FILES = [
  '',
  FOLDER,
  `${FOLDER}${V}-1.png/`,
  `/${FOLDER}${V}-1.png`,
  `${FOLDER}${V}-01.png`,
  `${FOLDER}${V}-1.PNG`,
  `${FOLDER}${V}-1.png.partial`,
  `${FOLDER}${V}.png`,
  `${FOLDER}sub/${V}-1.png`,
  `${FOLDER}..%2F${V}-1.png`,
  `${FOLDER}%6b3f9q2-1.png`,
  `adman-approvals/${P}/${C}/../other-abc234/${V}-1.png`,
  `adman-approvals/${P}/${C}\\${V}-1.png`,
  `other/${P}/${C}/${V}-1.png`,
  `adman-approvals/${P}/${V}-1.png`,
  `x/adman-approvals/${P}/${C}/${V}-1.png`,
  `adman-approvals//${P}/${C}/${V}-1.png`,
]

describe('pictureFolderOf: only a picture file inside a campaign folder [spec/approvals.md "Pictures"]', () => {
  it.each(NOT_PICTURE_FILES)('refuses %j', (path) => {
    expect(() => pictureFolderOf(path)).toThrow(new Error(REFUSED_PATH))
  })
})

describe('checkPictureFolder: only a whole campaign folder [spec/approvals.md "Pictures"]', () => {
  it.each([
    '',
    'adman-approvals/',
    `adman-approvals/${P}/`,
    `adman-approvals/${P}/${C}`,
    `adman-approvals/${P}/${C}//`,
    `adman-approvals/${P}/${C}/sub/`,
    `/adman-approvals/${P}/${C}/`,
    `adman-approvals/${P}/../${C}/`,
    `adman-approvals/${P}/%2e%2e/`,
    `${FOLDER}${V}-1.png`,
  ])('refuses %j', (folder) => {
    expect(() => checkPictureFolder(folder)).toThrow(new Error(REFUSED_PATH))
  })
})

describe('picturesIn: what a listing may give back [spec/approvals.md "Pictures"]', () => {
  it('keeps only picture files directly inside the folder', () => {
    const found = [
      `${FOLDER}${V}-1.png`,
      `${FOLDER}aaaaaa-2.png`,
      `${FOLDER}sub/${V}-1.png`,
      `${FOLDER}notes.txt`,
      `adman-approvals/${P}/other-abc234/${V}-1.png`,
      `${FOLDER}`,
    ]
    expect(picturesIn(FOLDER, found)).toEqual([`${FOLDER}${V}-1.png`, `${FOLDER}aaaaaa-2.png`])
  })

  it('refuses a folder that is not a campaign folder', () => {
    expect(() => picturesIn('adman-approvals/', [])).toThrow(new Error(REFUSED_PATH))
  })
})

describe('removalFolder: one campaign folder per removal [spec/approvals.md "Pictures"]', () => {
  it('gives the folder of picture files in one folder, and null for none', () => {
    expect(removalFolder([`${FOLDER}${V}-1.png`, `${FOLDER}aaaaaa-2.png`])).toBe(FOLDER)
    expect(removalFolder([])).toBeNull()
  })

  it.each([
    [[`${FOLDER}${V}-1.png`, `adman-approvals/${P}/other-abc234/${V}-1.png`]],
    [[`${FOLDER}${V}-1.png`, `adman-approvals/01JD5Z8Q4N3V6W7X8Y9Z0ABCDF/${C}/${V}-1.png`]],
    [[`${FOLDER}${V}-1.png`, FOLDER]],
    [[`${FOLDER}${V}-1.png`, `${FOLDER}notes.txt`]],
  ])('refuses %j', (paths) => {
    expect(() => removalFolder(paths)).toThrow(new Error(REFUSED_PATH))
  })
})

describe('checkPictureLifetime: at most 7 days [spec/approvals.md "Pictures"]', () => {
  it('takes 1 to 604,800 whole seconds', () => {
    expect(checkPictureLifetime(1)).toBe(1)
    expect(checkPictureLifetime(604_800)).toBe(604_800)
  })

  it.each([604_801, 0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('refuses %s', (s) => {
    expect(() => checkPictureLifetime(s)).toThrow(new Error(REFUSED_LIFETIME))
  })

  it('has the same limit and words as the S3 adapter', () => {
    expect(PICTURE_URL_MAX_SECONDS).toBe(signing.SIGNED_URL_MAX_SECONDS)
    expect(REFUSED_LIFETIME).toBe(signing.REFUSED_LIFETIME)
  })
})
