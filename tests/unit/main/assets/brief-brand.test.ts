// BB-3 (security class): checkBriefBrand on a real temp folder (spec/brief-brand.md
// "brief.parse"). A brief may name a logo and two fonts by asset ID, absolute path or a path
// relative to the brief file. A bad one gives a note with the file's last part only, never
// an error and never a folder.
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { checkBriefBrand, type BrandAssetOf } from '@/main/assets/brief-brand'
import type { BriefDraft } from '@/shared/schemas/brief'

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])
const WOFF2 = Buffer.from('wOF2\u0000\u0001\u0000\u0000made-up font bytes')
const OTF = Buffer.from('OTTOmade-up font bytes')

const FONT_ID = '01JABCDEFGHJKMNPQRSTVWXYZ0'
const IMAGE_ID = '01JABCDEFGHJKMNPQRSTVWXYZ1'
const REFERENCE_ID = '01JABCDEFGHJKMNPQRSTVWXYZ2'
const VIDEO_ID = '01JABCDEFGHJKMNPQRSTVWXYZ3'
const UNKNOWN_ID = '01JABCDEFGHJKMNPQRSTVWXYZ4'

const ASSETS: Record<string, { kind: string; library: string }> = {
  [FONT_ID]: { kind: 'font', library: 'asset' },
  [IMAGE_ID]: { kind: 'image', library: 'asset' },
  [REFERENCE_ID]: { kind: 'image', library: 'reference' },
  [VIDEO_ID]: { kind: 'video', library: 'asset' },
}
const assetOf: BrandAssetOf = (id) => ASSETS[id] ?? null

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brief-brand-'))
const real = fs.realpathSync(root)
const briefPath = path.join(root, 'brief/brief.yaml')
const inBrief = (...parts: string[]) => path.join(real, 'brief', ...parts)

beforeAll(() => {
  const at = (rel: string, bytes: Buffer | string) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
    fs.writeFileSync(path.join(root, rel), bytes)
  }
  at('brief/brief.yaml', 'brand: {}')
  at('brief/brand/logo.png', PNG)
  at('brief/brand/Headline.woff2', WOFF2)
  at('brief/brand/Body.otf', OTF)
  at('brief/brand/fake.woff2', PNG)
  at('elsewhere/outside.png', PNG)
  fs.mkdirSync(path.join(root, 'brief/brand/folder.woff2'))
})
afterAll(() => fs.rmSync(root, { recursive: true, force: true }))
afterEach(() => vi.restoreAllMocks())

type Brand = NonNullable<BriefDraft['brand']>
const draftOf = (brand: Brand): BriefDraft => ({ brand })
const check = (brand: Brand, brief: string | null = briefPath, platform?: NodeJS.Platform) =>
  checkBriefBrand(brief, draftOf(brand), { assetOf, platform })

describe('checkBriefBrand reads files beside the brief [BB-3]', () => {
  it('accepts a relative logo and two fonts, in role order, by their real paths', async () => {
    const result = await check({
      fonts: { body: 'brand/Body.otf', heading: 'brand\\Headline.woff2' },
      logo: './brand/logo.png',
    })
    expect(result).toEqual({
      files: [
        { role: 'logo', path: inBrief('brand/logo.png'), assetId: null },
        { role: 'headingFont', path: inBrief('brand/Headline.woff2'), assetId: null },
        { role: 'bodyFont', path: inBrief('brand/Body.otf'), assetId: null },
      ],
      notes: [],
    })
  })

  it('accepts a path leading out of the folder and an absolute path', async () => {
    const result = await check({
      logo: '../elsewhere/outside.png',
      fonts: { heading: path.join(root, 'brief/brand/Headline.woff2') },
    })
    expect(result.files).toEqual([
      { role: 'logo', path: path.join(real, 'elsewhere/outside.png'), assetId: null },
      { role: 'headingFont', path: inBrief('brand/Headline.woff2'), assetId: null },
    ])
    expect(result.notes).toEqual([])
  })

  it('gives both roles the same file when heading and body name it', async () => {
    const font = 'brand/Headline.woff2'
    const result = await check({ fonts: { heading: font, body: font } })
    expect(result.files).toEqual([
      { role: 'headingFont', path: inBrief(font), assetId: null },
      { role: 'bodyFont', path: inBrief(font), assetId: null },
    ])
  })

  it('gives an empty result when the brief names no brand file', async () => {
    expect(await checkBriefBrand(briefPath, {}, { assetOf })).toEqual({ files: [], notes: [] })
    expect(await check({ colours: ['#0B3D2E'] })).toEqual({ files: [], notes: [] })
  })
})

describe('checkBriefBrand notes [BB-3]', () => {
  it.each([
    ['a missing file', { logo: 'brand/gone.png' }, 'logo', 'gone.png', 'not_found'],
    [
      'a folder',
      { fonts: { body: 'brand/folder.woff2' } },
      'bodyFont',
      'folder.woff2',
      'not_found',
    ],
    [
      'a PNG named .woff2',
      { fonts: { heading: 'brand/fake.woff2' } },
      'headingFont',
      'fake.woff2',
      'not_a_font',
    ],
    [
      'a WOFF2 as logo',
      { logo: 'brand/Headline.woff2' },
      'logo',
      'Headline.woff2',
      'not_a_picture',
    ],
    [
      'a picture as a font',
      { fonts: { body: 'brand/logo.png' } },
      'bodyFont',
      'logo.png',
      'not_a_font',
    ],
    ['a blank text', { logo: '' }, 'logo', '(no name)', 'not_found'],
  ] as const)('gives %s its note and no entry', async (_case, brand, role, name, reason) => {
    expect(await check(brand)).toEqual({ files: [], notes: [{ role, name, reason }] })
  })

  it('keeps the good roles when one has a note', async () => {
    const result = await check({ logo: 'brand/gone.png', fonts: { body: 'brand/Body.otf' } })
    expect(result).toEqual({
      files: [{ role: 'bodyFont', path: inBrief('brand/Body.otf'), assetId: null }],
      notes: [{ role: 'logo', name: 'gone.png', reason: 'not_found' }],
    })
  })

  it('gives a relative path from pasted text not_full_path and opens nothing', async () => {
    const spies = [
      vi.spyOn(fsp, 'realpath'),
      vi.spyOn(fsp, 'stat'),
      vi.spyOn(fsp, 'open'),
      vi.spyOn(fsp, 'readFile'),
    ]
    const result = await check({ logo: 'brand/logo.png', fonts: { heading: '' } }, null)
    expect(result).toEqual({
      files: [],
      notes: [
        { role: 'logo', name: 'logo.png', reason: 'not_full_path' },
        { role: 'headingFont', name: '(no name)', reason: 'not_full_path' },
      ],
    })
    for (const spy of spies) expect(spy).not.toHaveBeenCalled()
  })

  it('accepts an absolute path from pasted text', async () => {
    const result = await check({ logo: path.join(root, 'brief/brand/logo.png') }, null)
    expect(result.files).toEqual([{ role: 'logo', path: inBrief('brand/logo.png'), assetId: null }])
  })

  it('names a file by its last part only, never a folder', async () => {
    const result = await check({
      logo: path.join(root, 'secret-folder/gone.png'),
      fonts: { heading: '../secret-place/x.woff2', body: 'brand/folder.woff2' },
    })
    expect(result.notes.map((n) => n.name)).toEqual(['gone.png', 'x.woff2', 'folder.woff2'])
    const said = JSON.stringify(result.notes)
    for (const text of [root, real, 'secret', 'brand/', 'elsewhere']) {
      expect(said).not.toContain(text)
    }
  })
})

describe('checkBriefBrand asset IDs [BB-3, A-405, R-12]', () => {
  it('accepts a font for a font role and a picture for the logo, in either case', async () => {
    const result = await check({
      logo: IMAGE_ID.toLowerCase(),
      fonts: { heading: FONT_ID, body: FONT_ID },
    })
    expect(result).toEqual({
      files: [
        { role: 'logo', path: null, assetId: IMAGE_ID },
        { role: 'headingFont', path: null, assetId: FONT_ID },
        { role: 'bodyFont', path: null, assetId: FONT_ID },
      ],
      notes: [],
    })
  })

  it.each([
    ['a font as logo', { logo: FONT_ID }, 'logo', FONT_ID],
    ['a picture as a font', { fonts: { heading: IMAGE_ID } }, 'headingFont', IMAGE_ID],
    ['a reference-library picture', { logo: REFERENCE_ID }, 'logo', REFERENCE_ID],
    ['a video as logo', { logo: VIDEO_ID }, 'logo', VIDEO_ID],
    ['an unknown ID', { fonts: { body: UNKNOWN_ID } }, 'bodyFont', UNKNOWN_ID],
  ] as const)('gives %s unknown_asset', async (_case, brand, role, name) => {
    expect(await check(brand)).toEqual({
      files: [],
      notes: [{ role, name, reason: 'unknown_asset' }],
    })
  })
})

describe('checkBriefBrand on Windows rules [BB-3, R2P-3 review]', () => {
  it.each(['\\\\server\\share\\a.woff2', '//server/share/a.woff2', '\\\\?\\C:\\fonts\\a.woff2'])(
    'gives %s not_readable and opens nothing',
    async (text) => {
      const spies = [
        vi.spyOn(fsp, 'realpath'),
        vi.spyOn(fsp, 'stat'),
        vi.spyOn(fsp, 'open'),
        vi.spyOn(fsp, 'readFile'),
      ]
      const result = await check({ fonts: { heading: text } }, briefPath, 'win32')
      expect(result).toEqual({
        files: [],
        notes: [{ role: 'headingFont', name: 'a.woff2', reason: 'not_readable' }],
      })
      for (const spy of spies) expect(spy).not.toHaveBeenCalled()
    },
  )
})

describe('checkBriefBrand never throws and never logs [BB-3]', () => {
  it('writes nothing to the console or the output streams', async () => {
    const loggers = [
      vi.spyOn(console, 'log'),
      vi.spyOn(console, 'info'),
      vi.spyOn(console, 'warn'),
      vi.spyOn(console, 'error'),
      vi.spyOn(console, 'debug'),
      vi.spyOn(process.stderr, 'write'),
      vi.spyOn(process.stdout, 'write'),
    ]
    await check({ logo: 'brand/gone.png', fonts: { heading: 'x\u0000.woff2', body: '' } })
    await check({ logo: 'brand/logo.png' }, path.join(root, 'no-such-folder/brief.yaml'))
    for (const spy of loggers) expect(spy).not.toHaveBeenCalled()
  })

  it('gives every role a note when the brief folder cannot be read', async () => {
    const result = await check({ logo: 'a.png' }, path.join(root, 'no-such-folder/brief.yaml'))
    expect(result).toEqual({
      files: [],
      notes: [{ role: 'logo', name: 'a.png', reason: 'not_readable' }],
    })
  })
})
