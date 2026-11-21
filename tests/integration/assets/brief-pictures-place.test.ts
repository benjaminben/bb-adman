// SP-1 review fixes (security class): a brief whose folder is too wide checks no path, and
// the cases the review found unpinned: a sibling folder whose name starts with the brief's
// folder name, a FIFO, and a brief folder with no real path.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { checkBriefPictures, isWideFolder } from '@/main/assets/brief-pictures'

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])

let root: string
let real: string
beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'brief-place-'))
  real = fs.realpathSync(root)
  fs.mkdirSync(path.join(root, 'brief/inner'), { recursive: true })
  fs.mkdirSync(path.join(root, 'briefc'))
  fs.writeFileSync(path.join(root, 'brief/a.png'), PNG)
  fs.writeFileSync(path.join(root, 'brief/inner/b.png'), PNG)
  fs.writeFileSync(path.join(root, 'briefc/x.png'), PNG)
  fs.symlinkSync(path.join(root, 'briefc/x.png'), path.join(root, 'brief/sibling.png'))
  fs.symlinkSync(path.join(root, 'briefc'), path.join(root, 'brief/sibling-dir'))
})
afterAll(() => fs.rmSync(root, { recursive: true, force: true }))

const brief = (...parts: string[]) => path.join(root, ...parts, 'brief.json')
const darwinHome = (home: string) => ({ home, platform: 'darwin' as const })

describe('isWideFolder: a folder too wide to take photos from [A-123, SP-1 review Low 2]', () => {
  const home = '/Users/someone'
  const winHome = 'C:\\Users\\someone'
  it.each([
    ['/', home, 'darwin', true],
    ['/', '/home/someone', 'linux', true],
    ['C:\\', winHome, 'win32', true],
    ['c:\\', winHome, 'win32', true],
    ['\\\\host\\share\\', winHome, 'win32', true],
    ['/Volumes/Disk', home, 'darwin', true],
    ['/volumes/Disk', home, 'darwin', true],
    ['/Volumes', home, 'darwin', true],
    [home, home, 'darwin', true],
    ['/users/SOMEONE', home, 'darwin', true],
    [winHome, winHome, 'win32', true],
    ['c:\\users\\Someone', winHome, 'win32', true],
    ['/home/someone', '/home/someone', 'linux', true],
    ['/Volumes/Disk/briefs', home, 'darwin', false],
    [`${home}/Downloads`, home, 'darwin', false],
    [`${home}/Desktop`, home, 'darwin', false],
    [`${home}/work/brief`, home, 'darwin', false],
    ['C:\\Users\\someone\\Downloads', winHome, 'win32', false],
    ['/Volumes/Disk', '/home/someone', 'linux', false],
    ['/home/Someone', '/home/someone', 'linux', false],
  ] as const)('%j with home %j on %s is wide: %s', (dir, realHome, platform, wide) => {
    expect(isWideFolder(dir, realHome, platform)).toBe(wide)
  })
})

describe('checkBriefPictures in a wide folder [SP-1 review Low 2]', () => {
  it('checks no path and gives wide_folder when the brief sits in the home folder', async () => {
    const result = await checkBriefPictures(
      brief('brief'),
      [{ pictures: ['a.png', '../x.png'] }, { name: 'Jar' }],
      darwinHome(path.join(root, 'brief')),
    )
    expect(result).toEqual([
      {
        paths: [],
        notes: [
          { name: 'a.png', reason: 'wide_folder' },
          { name: 'x.png', reason: 'wide_folder' },
        ],
      },
      { paths: [], notes: [] },
    ])
  })

  it('compares the home folder by its real path', async () => {
    const linkedHome = path.join(root, 'home-link')
    fs.symlinkSync(path.join(root, 'brief'), linkedHome)
    const [result] = await checkBriefPictures(
      brief('brief'),
      [{ pictures: 'a.png' }],
      darwinHome(linkedHome),
    )
    expect(result).toEqual({ paths: [], notes: [{ name: 'a.png', reason: 'wide_folder' }] })
  })

  it('accepts photos for a brief in a folder inside home', async () => {
    const [result] = await checkBriefPictures(
      brief('brief', 'inner'),
      [{ pictures: 'b.png' }],
      darwinHome(path.join(root, 'brief')),
    )
    expect(result).toEqual({ paths: [path.join(real, 'brief/inner/b.png')], notes: [] })
  })
})

describe('checkBriefPictures: cases the review pinned [SP-1 review Note 5]', () => {
  it.each(['sibling.png', 'sibling-dir/x.png'])(
    'refuses %j, a link into a sibling whose name starts with the folder name',
    async (text) => {
      const [result] = await checkBriefPictures(brief('brief'), [{ pictures: text }])
      expect(result).toEqual({
        paths: [],
        notes: [{ name: path.basename(text), reason: 'outside_folder' }],
      })
    },
  )

  it.skipIf(process.platform === 'win32')(
    'refuses a FIFO without opening it, at once',
    async () => {
      execFileSync('mkfifo', [path.join(root, 'brief/pipe.png')])
      const started = Date.now()
      const [result] = await checkBriefPictures(brief('brief'), [{ pictures: 'pipe.png' }])
      expect(result).toEqual({ paths: [], notes: [{ name: 'pipe.png', reason: 'not_found' }] })
      expect(Date.now() - started).toBeLessThan(1000)
    },
    2000,
  )

  it('gives not_readable for every picture when the folder has no real path', async () => {
    const [result] = await checkBriefPictures(brief('gone'), [{ pictures: ['a.png', 'b.png'] }])
    expect(result).toEqual({
      paths: [],
      notes: [
        { name: 'a.png', reason: 'not_readable' },
        { name: 'b.png', reason: 'not_readable' },
      ],
    })
  })
})
