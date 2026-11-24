import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  fileTypeOf,
  readBrand,
  readBriefFile,
  readSubjectPhotos,
} from '../../../quickstart/brief-files'
import { readPlan } from '../../../quickstart/plan'

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])
const WOFF2 = new TextEncoder().encode('wOF2 and the rest')
const SIMPLE = fileURLToPath(
  new URL('../../../quickstart/examples/simple-routine', import.meta.url),
)
const SPLASH = fileURLToPath(new URL('../../../quickstart/examples/summer-splash', import.meta.url))

let folder = ''
beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), 'quickstart-files-'))
  await mkdir(join(folder, 'brand'))
  await writeFile(join(folder, 'brand', 'logo.png'), PNG)
  await writeFile(join(folder, 'brand', 'fake.png'), 'not a picture')
  await writeFile(join(folder, 'brand', 'Head.woff2'), WOFF2)
})
afterAll(() => rm(folder, { recursive: true, force: true }))

function planOf(text: string) {
  const result = readPlan(text, 'yaml')
  if (!result.ok) throw new Error(result.message)
  return result.plan
}

const BRIEF = 'campaignName: A\nregion: US\naudience: B\nmessage: C\n'

describe('quickstart fileTypeOf', () => {
  it('takes a file of the wanted kind by its ending and first bytes', () => {
    expect(fileTypeOf('logo.png', PNG, 'image')?.mime).toBe('image/png')
    expect(fileTypeOf('Head.woff2', WOFF2, 'font')?.mime).toBe('font/woff2')
  })

  it('refuses a file of another kind or whose bytes do not match its ending', () => {
    expect(fileTypeOf('logo.png', PNG, 'font')).toBeUndefined()
    expect(fileTypeOf('logo.png', WOFF2, 'image')).toBeUndefined()
    expect(fileTypeOf('logo.gif', PNG, 'image')).toBeUndefined()
  })
})

describe('quickstart readBriefFile', () => {
  it('reads a file beside the brief, or at a full path', async () => {
    const beside = await readBriefFile(folder, 'brand/logo.png', 'image')
    expect(beside).toMatchObject({ ok: true, mime: 'image/png' })
    const full = await readBriefFile('/elsewhere', join(folder, 'brand', 'logo.png'), 'image')
    expect(full).toMatchObject({ ok: true, mime: 'image/png' })
  })

  it('gives a reason for a missing file or one of the wrong type', async () => {
    expect(await readBriefFile(folder, 'brand/none.png', 'image')).toEqual({
      ok: false,
      reason: 'not_found',
    })
    expect(await readBriefFile(folder, 'brand/fake.png', 'image')).toEqual({
      ok: false,
      reason: 'not_a_picture',
    })
    expect(await readBriefFile(folder, 'brand/logo.png', 'font')).toEqual({
      ok: false,
      reason: 'not_a_font',
    })
  })

  it('never opens a Windows network path', async () => {
    const answer = await readBriefFile(folder, '\\\\server\\share\\logo.png', 'image', 'win32')
    expect(answer).toEqual({ ok: false, reason: 'not_readable' })
  })
})

describe('quickstart readSubjectPhotos', () => {
  it('leaves a missing photo out with one note naming its last part', async () => {
    const plan = planOf(
      `${BRIEF}subjects:\n  - name: D\n    pictures: [brand/logo.png, /no/such/place/can.png]\n`,
    )
    const read = await readSubjectPhotos(plan, folder)
    expect(read.files.map((f) => f.mime)).toEqual(['image/png'])
    expect(read.notes).toEqual(['The photo "can.png" was not found. It is left out.'])
  })

  it('reads both photos of the simple-routine example', async () => {
    const text = await import('node:fs/promises').then((fs) =>
      fs.readFile(join(SIMPLE, 'brief.yaml'), 'utf8'),
    )
    const read = await readSubjectPhotos(planOf(text), SIMPLE)
    expect(read.files).toHaveLength(2)
    expect(read.notes).toEqual([])
  })
})

describe('quickstart readBrand', () => {
  it('reads the logo and the fonts, with each font family name', async () => {
    const text = await import('node:fs/promises').then((fs) =>
      fs.readFile(join(SPLASH, 'brief.yaml'), 'utf8'),
    )
    const brand = await readBrand(planOf(text), SPLASH)
    expect(brand.logo?.mime).toBe('image/png')
    expect(brand.logo?.width).toBeGreaterThan(0)
    expect(brand.heading?.mime).toBe('font/woff2')
    expect(brand.heading?.family).toBe('Archivo Black')
    expect(brand.body?.family).toBe('Archivo SemiBold')
    expect(brand.notes).toEqual([])
  })

  it('leaves out a brand file that is missing or of the wrong type, with a note each', async () => {
    const text = `${BRIEF}subjects:\n  - name: D\nbrand:\n  logo: brand/fake.png\n  fonts:\n    heading: brand/Head.woff2\n    body: brand/logo.png\n`
    const brand = await readBrand(planOf(text), folder)
    expect(brand.logo).toBeNull()
    expect(brand.heading?.mime).toBe('font/woff2')
    expect(brand.body).toBeNull()
    expect(brand.notes).toEqual([
      'The logo "fake.png" is not a PNG, JPEG or WebP picture. It is left out.',
      'The text font "logo.png" is not a TTF, OTF or WOFF2 font. It is left out.',
    ])
  })
})
