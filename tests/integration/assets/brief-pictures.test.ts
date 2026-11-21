// SP-1 (security class): checkBriefPictures on a real temp folder. A brief may come from
// someone else, so a path it names is used only when its real place is inside the brief's
// folder and its first bytes are a PNG, JPEG or WebP (spec/subject-photos.md, the six rules).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { checkBriefPictures, picturesWithoutFolder } from '@/main/assets/brief-pictures'

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1])
const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([4, 0, 0, 0]),
  Buffer.from('WEBPVP8 '),
])

let root: string
let real: string
let briefPath: string
const inBrief = (...parts: string[]) => path.join(real, 'brief', ...parts)

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'brief-pictures-'))
  real = fs.realpathSync(root)
  const at = (rel: string, bytes: Buffer | string) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
    fs.writeFileSync(path.join(root, rel), bytes)
  }
  at('brief/brief.json', '{}')
  at('brief/a.png', PNG)
  at('brief/photos/b.jpg', JPEG)
  at('brief/photos/w.webp', WEBP)
  at('brief/upper/A.PNG', PNG)
  at('brief/upper/B.PNG', 'not a picture')
  at('brief/photos/d.png', 'just text')
  at('brief/photos/e.txt', PNG)
  at('brief/photos/f.png', '')
  at('brief/photos/%2e%2e', PNG)
  fs.mkdirSync(path.join(root, 'brief/photos/c.png'))
  at('outside/x.png', PNG)
  const link = (target: string, rel: string) => fs.symlinkSync(target, path.join(root, rel))
  link(path.join(root, 'brief/a.png'), 'brief/inside-link.png')
  link('a.png', 'brief/relative-link.png')
  link(path.join(root, 'outside/x.png'), 'brief/out-link.png')
  link(path.join(root, 'outside'), 'brief/out-dir')
  link(path.join(root, 'brief/nothing.png'), 'brief/dangling.png')
  link(path.join(root, 'brief/loop-b.png'), 'brief/loop-a.png')
  link(path.join(root, 'brief/loop-a.png'), 'brief/loop-b.png')
  link(path.join(root, 'brief'), 'linked')
  briefPath = path.join(root, 'brief/brief.json')
})
afterAll(() => fs.rmSync(root, { recursive: true, force: true }))

const loggers = () => [
  vi.spyOn(console, 'log'),
  vi.spyOn(console, 'info'),
  vi.spyOn(console, 'warn'),
  vi.spyOn(console, 'error'),
  vi.spyOn(console, 'debug'),
  vi.spyOn(process.stderr, 'write'),
  vi.spyOn(process.stdout, 'write'),
]
afterEach(() => vi.restoreAllMocks())

async function one(text: string, brief = briefPath) {
  const [result] = await checkBriefPictures(brief, [{ name: 'Can', pictures: [text] }])
  if (!result) throw new Error('No entry for the subject')
  return result
}

describe('checkBriefPictures accepts a picture inside the brief folder [D-098, SP-1]', () => {
  it.each([
    ['a.png', 'a.png'],
    ['./a.png', 'a.png'],
    ['photos/b.jpg', 'photos/b.jpg'],
    ['photos\\b.jpg', 'photos/b.jpg'],
    ['.\\photos//./b.jpg', 'photos/b.jpg'],
    ['photos/w.webp', 'photos/w.webp'],
    ['upper/A.PNG', 'upper/A.PNG'],
    ['inside-link.png', 'a.png'],
    ['relative-link.png', 'a.png'],
  ])('accepts %j as the real path of %s', async (text, accepted) => {
    expect(await one(text)).toEqual({ paths: [inBrief(accepted)], notes: [] })
  })

  it('reads %2e%2e as a file name, not decoded', async () => {
    expect(await one('photos/%2e%2e')).toEqual({
      paths: [],
      notes: [{ name: '%2e%2e', reason: 'not_a_picture' }],
    })
  })

  it('keeps one file named twice in a subject once, with no note', async () => {
    const [result] = await checkBriefPictures(briefPath, [
      { pictures: ['photos/b.jpg', 'photos\\b.jpg', 'a.png', 'inside-link.png'] },
    ])
    expect(result).toEqual({ paths: [inBrief('photos/b.jpg'), inBrief('a.png')], notes: [] })
  })

  it('accepts the same picture for two subjects', async () => {
    const result = await checkBriefPictures(briefPath, [
      { pictures: 'a.png' },
      { pictures: 'a.png' },
    ])
    expect(result).toEqual([
      { paths: [inBrief('a.png')], notes: [] },
      { paths: [inBrief('a.png')], notes: [] },
    ])
  })

  it('accepts its own photos for a brief opened through a linked folder', async () => {
    const linkedBrief = path.join(root, 'linked/brief.json')
    expect(await one('photos/b.jpg', linkedBrief)).toEqual({
      paths: [inBrief('photos/b.jpg')],
      notes: [],
    })
  })

  it('gives one entry per subject, empty for a subject with no pictures', async () => {
    expect(await checkBriefPictures(briefPath, undefined)).toEqual([])
    expect(await checkBriefPictures(briefPath, [{ name: 'Can' }, { pictures: [] }])).toEqual([
      { paths: [], notes: [] },
      { paths: [], notes: [] },
    ])
  })
})

const LONG_UP = `${'../'.repeat(2000)}x.png`
describe('checkBriefPictures refuses a path outside the folder [D-098, SP-1]', () => {
  it.each([
    ['', '(no name)'],
    ['/abs/x.png', 'x.png'],
    [path.join(os.tmpdir(), 'x.png'), 'x.png'],
    ['C:\\x.png', 'x.png'],
    ['C:/x.png', 'x.png'],
    ['C:x.png', 'C:x.png'],
    ['\\\\host\\share\\x.png', 'x.png'],
    ['//host/x.png', 'x.png'],
    ['\\x.png', 'x.png'],
    ['~/x.png', 'x.png'],
    ['~x.png', '~x.png'],
    ['../x.png', 'x.png'],
    ['../outside/x.png', 'x.png'],
    ['photos/../../x.png', 'x.png'],
    ['photos\\..\\..\\x.png', 'x.png'],
    ['photos/..\\../outside/x.png', 'x.png'],
    ['a.png\u0000.txt', 'a.png.txt'],
    ['out-link.png', 'out-link.png'],
    ['out-dir/x.png', 'x.png'],
    [LONG_UP, 'x.png'],
  ])('gives outside_folder for %j', async (text, name) => {
    expect(await one(text)).toEqual({ paths: [], notes: [{ name, reason: 'outside_folder' }] })
  })
})

describe('checkBriefPictures notes a missing file or a non-picture [D-098, SP-1]', () => {
  it.each([
    ['missing.png', 'not_found'],
    ['photos/c.png', 'not_found'],
    ['dangling.png', 'not_found'],
    ['a.png/inner.png', 'not_found'],
    ['photos/d.png', 'not_a_picture'],
    ['photos/e.txt', 'not_a_picture'],
    ['photos/f.png', 'not_a_picture'],
    ['upper/B.PNG', 'not_a_picture'],
    ['loop-a.png', 'not_readable'],
  ])('gives %j the reason %s', async (text, reason) => {
    const result = await one(text)
    expect(result).toEqual({ paths: [], notes: [{ name: path.basename(text), reason }] })
  })

  it.each([
    ['a part longer than any file name', `${'a'.repeat(400)}.png`],
    ['a path deeper than the system allows', `${'abc/'.repeat(3000)}x.png`],
  ])('gives a note, not an error, for %s', async (_case, text) => {
    const result = await one(text)
    expect(result.paths).toEqual([])
    expect(result.notes).toHaveLength(1)
    expect(['not_found', 'not_readable']).toContain(result.notes[0]?.reason)
    expect(result.notes[0]?.name.length).toBeLessThanOrEqual(121)
  })

  it('keeps good pictures beside bad ones, in the brief order', async () => {
    const [result] = await checkBriefPictures(briefPath, [
      { pictures: ['../x.png', 'a.png', 'missing.png', 'photos/b.jpg'] },
    ])
    expect(result).toEqual({
      paths: [inBrief('a.png'), inBrief('photos/b.jpg')],
      notes: [
        { name: 'x.png', reason: 'outside_folder' },
        { name: 'missing.png', reason: 'not_found' },
      ],
    })
  })
})

describe('checkBriefPictures says nothing of a path [D-098, SP-1]', () => {
  it('writes no log line and puts no folder in a note', async () => {
    const spies = loggers()
    const texts = ['a.png', '../x.png', 'missing.png', 'photos/d.png', 'loop-a.png', 'out-link.png']
    const result = await checkBriefPictures(briefPath, [{ pictures: texts }])
    for (const spy of spies) expect(spy).not.toHaveBeenCalled()
    expect(JSON.stringify(result[0]?.notes)).not.toContain(real)
    expect(JSON.stringify(result[0]?.notes)).not.toContain('/')
  })

  it('gives every picture of a typed brief no_folder and checks no path', () => {
    expect(
      picturesWithoutFolder([{ pictures: ['a.png', 'photos/b.jpg'] }, { name: 'Can' }]),
    ).toEqual([
      {
        paths: [],
        notes: [
          { name: 'a.png', reason: 'no_folder' },
          { name: 'b.jpg', reason: 'no_folder' },
        ],
      },
      { paths: [], notes: [] },
    ])
  })
})
