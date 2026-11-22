// SP-1 review fixes (security class): a brief whose folder is too wide checks no path, and
// the cases the review found unpinned: a sibling folder whose name starts with the brief's
// folder name, a FIFO, and a brief folder with no real path.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { checkBriefPictures } from '@/main/assets/brief-pictures'

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

describe('checkBriefPictures: cases the review pinned [SP-1 review Note 5]', () => {
  // R2P-3 [D3]: the folder rule is lifted, so a link out of the folder is followed.
  it.each(['sibling.png', 'sibling-dir/x.png'])(
    'accepts %j, a link into a sibling whose name starts with the folder name',
    async (text) => {
      const [result] = await checkBriefPictures(brief('brief'), [{ pictures: text }])
      expect(result).toEqual({
        paths: [path.join(real, 'briefc/x.png')],
        assetIds: [],
        notes: [],
      })
    },
  )

  it.skipIf(process.platform === 'win32')(
    'refuses a FIFO without opening it, at once',
    async () => {
      execFileSync('mkfifo', [path.join(root, 'brief/pipe.png')])
      const started = Date.now()
      const [result] = await checkBriefPictures(brief('brief'), [{ pictures: 'pipe.png' }])
      expect(result).toEqual({
        paths: [],
        assetIds: [],
        notes: [{ name: 'pipe.png', reason: 'not_found' }],
      })
      expect(Date.now() - started).toBeLessThan(1000)
    },
    2000,
  )

  it('gives not_readable for every picture when the folder has no real path', async () => {
    const [result] = await checkBriefPictures(brief('gone'), [{ pictures: ['a.png', 'b.png'] }])
    expect(result).toEqual({
      paths: [],
      assetIds: [],
      notes: [
        { name: 'a.png', reason: 'not_readable' },
        { name: 'b.png', reason: 'not_readable' },
      ],
    })
  })
})
