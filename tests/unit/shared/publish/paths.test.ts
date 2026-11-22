// P9-7 (spec/storage-and-publish.md "Published layout", spec/phases/phase-09.md "Project-file
// values that reach a path"): every published path is built in paths.ts, and every part that
// comes from a project file is checked first. A hostile name never gives a path outside the
// campaign's own folder, an absolute path or an empty part.
import { describe, it, expect } from 'vitest'
import {
  MANIFEST,
  REPORT_HTML,
  REPORT_JSON,
  TRANSLATIONS_CSV,
  campaignFolder,
  campaignPath,
  componentPath,
  exportPath,
  isCampaignIdForm,
  type ComponentName,
} from '@/shared/publish/paths'
import { contentTypeFor } from '@/shared/publish/content-types'
import { isSafePart } from '@/shared/paths/safe-part'
import { storageFilePath } from '@/main/providers/storage-paths'

const REFUSED = 'Storage path refused'
const CAMPAIGN = 'summer-sale-ab23cd'
const ASSET = '01JD0000000000000000000007'
const SUBJECT = '01JD00000000000000000000S1'

const GOOD_IDS = ['summer-sale-ab23cd', 'campaign-x9y8z7', 'a-123456', `${'a'.repeat(40)}-abcdef`]
const BAD_IDS = [
  '',
  'ab23cd',
  'Summer-ab23cd',
  'a-ab23c',
  `${'a'.repeat(41)}-abcdef`,
  'a_b-ab23cd',
  '../x-ab23cd',
  'a/b-ab23cd',
  'a-ab23cd/',
  'a-ab23cd\n',
  '/a-ab23cd',
  'a.b-ab23cd',
  'a-ab23cD',
  'a-ab23cd ',
]

describe('the campaign ID form [P9-7, A-221]', () => {
  it.each(GOOD_IDS)('accepts %j and names its folder with it', (id) => {
    expect(isCampaignIdForm(id)).toBe(true)
    expect(campaignFolder(id)).toBe(id)
  })

  it.each(BAD_IDS)('refuses %j, with no path in the error', (id) => {
    expect(isCampaignIdForm(id)).toBe(false)
    expect(() => campaignFolder(id)).toThrow(new Error(REFUSED))
    expect(() => campaignPath(id, MANIFEST)).toThrow(new Error(REFUSED))
  })
})

describe('the files at the campaign folder top [P9-7, "Published layout"]', () => {
  it.each([
    [MANIFEST, 'manifest.json'],
    [REPORT_HTML, 'report.html'],
    [REPORT_JSON, 'report.json'],
    [TRANSLATIONS_CSV, 'translations.csv'],
  ])('puts %j at {campaignId}/%s', (name, file) => {
    expect(campaignPath(CAMPAIGN, name)).toBe(`${CAMPAIGN}/${file}`)
  })

  it.each(['', '.', '..', '../x', '/x', 'a//b', 'a/', 'a\\b', 'CON', 'a/./b', 'a\u0000b'])(
    'refuses the relative path %j',
    (rel) => {
      expect(() => campaignPath(CAMPAIGN, rel)).toThrow(new Error(REFUSED))
    },
  )
})

describe('exportPath [P9-7, "Published layout"]', () => {
  it('puts an exported ad under exports/', () => {
    expect(exportPath('Summer sale/1080x1080/en-US-ab23cd.png')).toBe(
      'exports/Summer sale/1080x1080/en-US-ab23cd.png',
    )
  })

  it.each(['', '../x.png', '/x.png', 'a//b.png', 'a/./b.png', 'a\\b.png', 'a/', 'CON/x.png'])(
    'refuses %j',
    (rel) => {
      expect(() => exportPath(rel)).toThrow(new Error(REFUSED))
    },
  )
})

const name = (over: Partial<ComponentName> = {}): ComponentName => ({
  folder: 'images',
  subjectId: null,
  displayName: 'Bottle shot',
  assetId: ASSET,
  ext: 'png',
  ...over,
})

describe('componentPath, each folder [P9-7, A-222]', () => {
  it.each([
    [
      name({ folder: 'backgrounds', ext: 'mp4' }),
      'components/backgrounds/Bottle shot-00000007.mp4',
    ],
    [name({ folder: 'logos' }), 'components/logos/Bottle shot-00000007.png'],
    [name({ folder: 'images', ext: 'jpg' }), 'components/images/Bottle shot-00000007.jpg'],
    [name({ folder: 'fonts', ext: 'woff2' }), 'components/fonts/Bottle shot-00000007.woff2'],
    [
      name({ folder: 'subjects', subjectId: SUBJECT }),
      `components/subjects/${SUBJECT}/Bottle shot-00000007.png`,
    ],
  ])('builds %j', (c, path) => {
    expect(componentPath(c)).toBe(path)
  })

  it('takes the last 8 characters of the asset ID, so IDs of one moment differ [P9-9]', () => {
    const first = componentPath(name({ assetId: '01JD000000AAAAAAAAAAAAAAAA' }))
    const second = componentPath(name({ assetId: '01JD000000BBBBBBBBBBBBBBBB' }))
    expect(first).toBe('components/images/Bottle shot-AAAAAAAA.png')
    expect(second).toBe('components/images/Bottle shot-BBBBBBBB.png')
  })

  it.each([
    ['a non-ULID asset ID', name({ assetId: '../../x' })],
    ['a lower-case asset ID', name({ assetId: ASSET.toLowerCase() })],
    ['an extension not listed', name({ ext: 'svg' })],
    ['a text extension', name({ ext: 'txt' })],
    ['an upper-case extension', name({ ext: 'PNG' })],
    ['an extension with a slash', name({ ext: 'png/..' })],
    ['a subjects folder with no subject', name({ folder: 'subjects' })],
    ['a subjects folder with a bad subject', name({ folder: 'subjects', subjectId: '../x' })],
    ['a subject outside the subjects folder', name({ subjectId: SUBJECT })],
    ['an unknown folder', name({ folder: '..' as ComponentName['folder'] })],
  ])('refuses %s', (_label, c) => {
    expect(() => componentPath(c)).toThrow(new Error(REFUSED))
  })
})

const HOSTILE_NAMES = [
  '',
  '.',
  '..',
  '../../../etc/passwd',
  '/etc/passwd',
  'C:\\Windows\\x',
  '\\\\server\\share',
  'a/b/c',
  'tab\tnul\u0000bell\u0007',
  'line\r\nbreak',
  'name.',
  'name   ',
  'CON',
  'lpt1',
  'x'.repeat(5000),
  'Logo',
  'LOGO',
  'Caf\u00e9',
  'Cafe\u0301',
  '\u202egnp.exe',
  '😀😀',
]
const FOLDERS: Array<Pick<ComponentName, 'folder' | 'subjectId'>> = [
  { folder: 'backgrounds', subjectId: null },
  { folder: 'logos', subjectId: null },
  { folder: 'images', subjectId: null },
  { folder: 'fonts', subjectId: null },
  { folder: 'subjects', subjectId: SUBJECT },
]

describe('a hostile display name stays inside the campaign folder [P9-7, security]', () => {
  const cases = HOSTILE_NAMES.flatMap((d) => FOLDERS.map((f) => [d, f] as const))
  it.each(cases)('%j in %j', (displayName, f) => {
    const rel = componentPath(name({ ...f, displayName }))
    const full = campaignPath(CAMPAIGN, rel)
    expect(full.startsWith(`${CAMPAIGN}/components/${f.folder}/`)).toBe(true)
    const parts = full.split('/')
    expect(parts).toHaveLength(f.subjectId ? 5 : 4)
    expect(parts.every(isSafePart)).toBe(true)
    expect(storageFilePath(full)).toBe(full)
    expect(parts.at(-1)).toMatch(/^[A-Za-z0-9+\-_ ]{1,86}-00000007\.png$/)
  })
})

describe('contentTypeFor [P9-7, "Uploads"]', () => {
  it.each([
    ['png', 'image/png'],
    ['jpg', 'image/jpeg'],
    ['webp', 'image/webp'],
    ['mp4', 'video/mp4'],
    ['mov', 'video/quicktime'],
    ['webm', 'video/webm'],
    ['ttf', 'font/ttf'],
    ['otf', 'font/otf'],
    ['woff2', 'font/woff2'],
    ['html', 'text/html; charset=utf-8'],
    ['json', 'application/json'],
    ['csv', 'text/csv; charset=utf-8'],
  ])('gives %s the type %s', (ext, type) => {
    expect(contentTypeFor(ext)).toBe(type)
    expect(contentTypeFor(`exports/a/b.${ext}`)).toBe(type)
  })

  it.each(['svg', 'txt', 'exe', '', 'PNG', 'constructor', 'toString'])(
    'gives %j no type',
    (ext) => {
      expect(contentTypeFor(ext)).toBeNull()
    },
  )
})
