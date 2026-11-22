// R2P-5 (spec/phases/round-2-platform.md, D5): the text rules an agent's file paths pass before
// the user is asked, and the real-path compare of the after-allow check.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { checkFile, importPathTexts, samePath } from '@/main/assets/import-files'
import { checkPathText, checkPathTexts } from '@/shared/assets/file-path-text'
import { greyPng } from '@/main/providers/fake/png'
import { AppError } from '@/shared/schemas/result'

const refusalOf = (run: () => unknown) => {
  try {
    run()
  } catch (e) {
    if (e instanceof AppError) return e.toBody()
    throw e
  }
  throw new Error('no refusal')
}

const PIC = '/Users/someone/Pictures/hero.png'

describe('the text rules before the ask [D5]', () => {
  it.each([
    ['a relative path', 'Pictures/hero.png', 'not_full_path', 'File 1 is not a full path.'],
    ['a bare name', 'hero.png', 'not_full_path', 'File 1 is not a full path.'],
    [
      'a path over 4,096 characters',
      `/${'a'.repeat(4096)}.png`,
      'not_full_path',
      'File 1 is not a full path.',
    ],
    [
      'a right-to-left mark (U+202E)',
      '/Users/someone/gnp.\u202Eevil.png',
      'hidden_characters',
      "File 1's path holds hidden characters.",
    ],
    [
      'a zero-width space (Cf)',
      '/Users/some\u200Bone/hero.png',
      'hidden_characters',
      "File 1's path holds hidden characters.",
    ],
    [
      'a line break (Cc)',
      '/Users/someone/he\nro.png',
      'hidden_characters',
      "File 1's path holds hidden characters.",
    ],
    [
      'a text file',
      '/Users/someone/notes.txt',
      'not_supported',
      'File 1 is not a picture, video or font Adman can use.',
    ],
    [
      'an SVG',
      '/Users/someone/logo.svg',
      'not_supported',
      'File 1 is not a picture, video or font Adman can use.',
    ],
    [
      'a sound',
      '/Users/someone/jingle.mp3',
      'not_supported',
      'File 1 is not a picture, video or font Adman can use.',
    ],
    [
      'a folder path',
      '/Users/someone/Pictures/',
      'not_supported',
      'File 1 is not a picture, video or font Adman can use.',
    ],
    [
      'no extension',
      '/Users/someone/hero',
      'not_supported',
      'File 1 is not a picture, video or font Adman can use.',
    ],
  ])('refuses %s', (_name, text, reason, message) => {
    expect(refusalOf(() => importPathTexts([text], 'darwin'))).toEqual({
      code: 'INVALID_INPUT',
      message,
      details: { reason, index: 1 },
    })
  })

  it('names the first bad file by its place, 1-based', () => {
    const paths = [PIC, '/Users/someone/clip.mp4', 'relative.ttf', '/x/notes.txt']
    expect(refusalOf(() => importPathTexts(paths, 'darwin'))).toEqual({
      code: 'INVALID_INPUT',
      message: 'File 3 is not a full path.',
      details: { reason: 'not_full_path', index: 3 },
    })
  })

  it('refuses more than 20 files before reading any of them', () => {
    const paths = Array.from({ length: 21 }, () => 'not a path')
    expect(refusalOf(() => importPathTexts(paths, 'darwin'))).toEqual({
      code: 'INVALID_INPUT',
      message: 'Give at most 20 files in one call.',
      details: { reason: 'too_many_files', index: 21 },
    })
  })

  it('takes 20 pictures, videos and fonts, normalised as node:path does', () => {
    const given = ['/a/b/../hero.PNG', '/a//c/./clip.mov', '/f/Brand.woff2', '/f/x.otf']
    const all = [...given, ...Array.from({ length: 16 }, (_, i) => `/p/${i}.webp`)]
    const paths = importPathTexts(all, 'darwin')
    expect(paths.slice(0, 4)).toEqual(given.map((p) => path.posix.normalize(p)))
    expect(paths).toHaveLength(20)
  })

  it('reads Windows paths on win32', () => {
    expect(checkPathText('C:\\Users\\a\\..\\b\\hero.jpg', 4, 'win32')).toEqual({
      ok: true,
      path: 'C:\\Users\\b\\hero.jpg',
    })
    expect(checkPathText('/Users/a/hero.jpg', 1, 'win32').ok).toBe(true)
    expect(checkPathText('Users\\a\\hero.jpg', 2, 'win32')).toEqual({
      ok: false,
      refusal: { reason: 'not_full_path', index: 2 },
    })
  })

  it('gives D6 the kinds it asks for', () => {
    expect(checkPathText('/a/clip.mp4', 1, 'darwin', ['image'])).toEqual({
      ok: false,
      refusal: { reason: 'not_supported', index: 1 },
    })
    expect(checkPathTexts([], 'darwin')).toEqual({ ok: true, paths: [] })
  })
})

describe('the real-path compare [D5]', () => {
  it('ignores letter case on macOS and Windows only', () => {
    expect(samePath('/Users/A/Hero.png', '/users/a/hero.PNG', 'darwin')).toBe(true)
    expect(samePath('C:\\Users\\Hero.png', 'c:\\users\\hero.png', 'win32')).toBe(true)
    expect(samePath('/home/a/Hero.png', '/home/a/hero.png', 'linux')).toBe(false)
    expect(samePath('/a/hero.png', '/a/other.png', 'darwin')).toBe(false)
  })
})

describe('checkFile on disk [D5]', () => {
  const roots: string[] = []
  afterEach(() => {
    for (const r of roots.splice(0)) fs.rmSync(r, { recursive: true, force: true })
  })
  const root = () => {
    const made = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'adman-files-')))
    roots.push(made)
    return made
  }

  it.runIf(process.platform === 'darwin')(
    'takes a path given in other letter case on macOS',
    async () => {
      const dir = root()
      fs.writeFileSync(path.join(dir, 'Hero.png'), greyPng(4, 4))
      const file = await checkFile(path.join(dir, 'hero.PNG'), 1)
      expect(file.type.kind).toBe('image')
    },
  )

  it('refuses a missing file, a folder and a link, by place only', async () => {
    const dir = root()
    fs.mkdirSync(path.join(dir, 'folder.png'))
    fs.writeFileSync(path.join(dir, 'real.png'), greyPng(4, 4))
    fs.symlinkSync(path.join(dir, 'real.png'), path.join(dir, 'link.png'))
    const body = async (p: string, n: number) => {
      try {
        await checkFile(path.join(dir, p), n)
      } catch (e) {
        return (e as AppError).toBody()
      }
      return null
    }
    expect(await body('gone.png', 2)).toEqual({
      code: 'NOT_FOUND',
      message: 'File 2 was not found.',
      details: { reason: 'file_not_found' },
    })
    expect(await body('folder.png', 3)).toMatchObject({ details: { reason: 'not_a_file' } })
    expect(await body('link.png', 4)).toMatchObject({
      message: "File 4 is reached through a link. Give the file's own full path.",
      details: { reason: 'file_is_link' },
    })
  })
})
