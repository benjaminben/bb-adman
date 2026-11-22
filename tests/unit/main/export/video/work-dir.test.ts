// P8-16: the video export's work folder, {userData}/export-work/{ULID}/ (spec/phases/phase-08.md
// "Video"): a job ID that is not a ULID is refused, a link at export-work is refused, the folder
// is this user's only, and the start-up clean-up removes only export-work/{ULID} folders.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ulid } from 'ulid'
import { cleanLeftovers, makeWorkDir } from '@/main/export/video/work-dir'

let dirs: string[] = []
afterEach(() => {
  for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true })
  dirs = []
})

function userData(): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'adman-work-dir-')))
  dirs.push(dir)
  return dir
}

describe('the export work folder (P8-16)', () => {
  it.each(['', 'abc', '../escape', '01HZY3V7Q8R9S0T1V2W3X4Y5Z', 'not-a-ulid-at-all-000000000'])(
    'refuses the job ID %j',
    async (jobId) => {
      const base = userData()
      await expect(makeWorkDir(base, jobId)).rejects.toThrow()
      expect(fs.existsSync(path.join(base, 'export-work', jobId || 'x'))).toBe(false)
    },
  )

  it('makes export-work/{ULID} for this user only and removes it', async () => {
    const base = userData()
    const jobId = ulid()
    const work = await makeWorkDir(base, jobId)
    expect(work.path).toBe(path.join(base, 'export-work', jobId))
    expect(fs.statSync(work.path).isDirectory()).toBe(true)
    if (process.platform !== 'win32') {
      expect(fs.statSync(work.path).mode & 0o777).toBe(0o700)
      expect(fs.statSync(path.join(base, 'export-work')).mode & 0o777).toBe(0o700)
    }
    fs.writeFileSync(path.join(work.path, 'ad.mp4'), 'x')
    await work.remove()
    expect(fs.existsSync(work.path)).toBe(false)
  })

  it.skipIf(process.platform === 'win32')('refuses a link at export-work', async () => {
    const base = userData()
    const elsewhere = userData()
    fs.symlinkSync(elsewhere, path.join(base, 'export-work'))
    await expect(makeWorkDir(base, ulid())).rejects.toThrow()
    expect(fs.readdirSync(elsewhere)).toEqual([])
  })

  it('cleans up only export-work/{ULID} folders that are real folders', async () => {
    const base = userData()
    const work = path.join(base, 'export-work')
    const left = path.join(work, ulid())
    fs.mkdirSync(left, { recursive: true })
    fs.writeFileSync(path.join(left, 'ad.mp4'), 'x')
    const other = path.join(work, 'keep-me')
    fs.mkdirSync(other)
    const file = path.join(work, ulid())
    fs.writeFileSync(file, 'a file, not a folder')
    const outside = userData()
    const linked = path.join(work, ulid())
    if (process.platform !== 'win32') fs.symlinkSync(outside, linked)
    fs.writeFileSync(path.join(outside, 'precious.txt'), 'x')
    const media = path.join(base, 'media-temp', ulid())
    fs.mkdirSync(media, { recursive: true })

    await cleanLeftovers(base)

    expect(fs.existsSync(left)).toBe(false)
    expect(fs.existsSync(other)).toBe(true)
    expect(fs.existsSync(file)).toBe(true)
    expect(fs.existsSync(path.join(outside, 'precious.txt'))).toBe(true)
    expect(fs.existsSync(media)).toBe(true)
  })

  it.skipIf(process.platform === 'win32')(
    'cleans up nothing when export-work is a link',
    async () => {
      const base = userData()
      const elsewhere = userData()
      const victim = path.join(elsewhere, ulid())
      fs.mkdirSync(victim)
      fs.symlinkSync(elsewhere, path.join(base, 'export-work'))
      await cleanLeftovers(base)
      expect(fs.existsSync(victim)).toBe(true)
    },
  )

  it('cleans up nothing, and fails nothing, when there is no export-work', async () => {
    const base = userData()
    await expect(cleanLeftovers(base)).resolves.toBeUndefined()
  })

  it('keeps the folder of an export still under way', async () => {
    const base = userData()
    const work = await makeWorkDir(base, ulid())
    await cleanLeftovers(base)
    await makeWorkDir(base, ulid()).then((w) => w.remove())
    expect(fs.existsSync(work.path)).toBe(true)
    await work.remove()
  })
})
