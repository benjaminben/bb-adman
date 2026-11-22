// SP-1 (security class): checkBriefPictures on a real temp folder. A brief may come from
// someone else, so a path it names is used only when its real place is inside the brief's
// folder and its first bytes are a PNG, JPEG or WebP (spec/subject-photos.md, the six rules).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { checkBriefPictures } from '@/main/assets/brief-pictures'

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
    expect(await one(text)).toEqual({ paths: [inBrief(accepted)], assetIds: [], notes: [] })
  })

  it('reads %2e%2e as a file name, not decoded', async () => {
    expect(await one('photos/%2e%2e')).toEqual({
      paths: [],
      assetIds: [],
      notes: [{ name: '%2e%2e', reason: 'not_a_picture' }],
    })
  })

  it('accepts a hard link inside the folder as an ordinary file', async () => {
    fs.linkSync(path.join(root, 'brief/a.png'), path.join(root, 'brief/hard.png'))
    expect(await one('hard.png')).toEqual({ paths: [inBrief('hard.png')], assetIds: [], notes: [] })
  })

  it('keeps one file named twice in a subject once, with no note', async () => {
    const [result] = await checkBriefPictures(briefPath, [
      { pictures: ['photos/b.jpg', 'photos\\b.jpg', 'a.png', 'inside-link.png'] },
    ])
    expect(result).toEqual({
      paths: [inBrief('photos/b.jpg'), inBrief('a.png')],
      assetIds: [],
      notes: [],
    })
  })

  it('accepts the same picture for two subjects', async () => {
    const result = await checkBriefPictures(briefPath, [
      { pictures: 'a.png' },
      { pictures: 'a.png' },
    ])
    expect(result).toEqual([
      { paths: [inBrief('a.png')], assetIds: [], notes: [] },
      { paths: [inBrief('a.png')], assetIds: [], notes: [] },
    ])
  })

  it('accepts its own photos for a brief opened through a linked folder', async () => {
    const linkedBrief = path.join(root, 'linked/brief.json')
    expect(await one('photos/b.jpg', linkedBrief)).toEqual({
      paths: [inBrief('photos/b.jpg')],
      assetIds: [],
      notes: [],
    })
  })

  it('gives one entry per subject, empty for a subject with no pictures', async () => {
    expect(await checkBriefPictures(briefPath, undefined)).toEqual([])
    expect(await checkBriefPictures(briefPath, [{ name: 'Can' }, { pictures: [] }])).toEqual([
      { paths: [], assetIds: [], notes: [] },
      { paths: [], assetIds: [], notes: [] },
    ])
  })
})

const LONG_UP = `${'../'.repeat(2000)}x.png`
// R2P-3 [D3]: the folder rule is lifted, so a path outside the folder is checked as a file.
describe('checkBriefPictures checks a path outside the folder as a file [D3, R2P-3]', () => {
  it.each(['../outside/x.png', 'photos/..\\../outside/x.png', 'out-link.png', 'out-dir/x.png'])(
    'accepts %j as the real path',
    async (text) => {
      const outside = path.join(real, 'outside/x.png')
      expect(await one(text)).toEqual({ paths: [outside], assetIds: [], notes: [] })
    },
  )

  it('accepts an absolute path outside the folder as the real path', async () => {
    const outside = path.join(real, 'outside/x.png')
    expect(await one(path.join(root, 'outside/x.png'))).toEqual({
      paths: [outside],
      assetIds: [],
      notes: [],
    })
  })

  it.each([
    ['', '(no name)'],
    ['/abs/x.png', 'x.png'],
    ['C:\\x.png', 'x.png'],
    ['C:/x.png', 'x.png'],
    ['C:x.png', 'C:x.png'],
    ['\\\\host\\share\\x.png', 'x.png'],
    ['//host/x.png', 'x.png'],
    ['\\x.png', 'x.png'],
    ['~/x.png', 'x.png'],
    ['~x.png', '~x.png'],
    ['../x.png', 'x.png'],
    ['photos/../../x.png', 'x.png'],
    ['photos\\..\\..\\x.png', 'x.png'],
    ['a.png\u0000.txt', 'a.png.txt'],
    [LONG_UP, 'x.png'],
  ])('gives not_found for %j, which names no file', async (text, name) => {
    expect(await one(text)).toEqual({
      paths: [],
      assetIds: [],
      notes: [{ name, reason: 'not_found' }],
    })
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
    expect(result).toEqual({
      paths: [],
      assetIds: [],
      notes: [{ name: path.basename(text), reason }],
    })
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
      assetIds: [],
      notes: [
        { name: 'x.png', reason: 'not_found' },
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
})
