import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'

type Verdict = { ok: true } | { ok: false; reason: string }
type FetchModule = {
  refuseRoot: (getuid?: () => number) => void
  realFolder: (folder: string) => void
  freshWork: (ffmpegDir: string) => string
  install: (built: string, ffmpegDir: string, key: string) => string
  fetchFfmpeg: (options: {
    ffmpegDir: string
    key: string
    getBinary: (work: string) => Promise<string>
    check: (binary: string) => Promise<Verdict>
  }) => Promise<string>
}

const { refuseRoot, realFolder, freshWork, install, fetchFfmpeg } = (await import(
  /* @vite-ignore */ path.resolve('scripts/ffmpeg/fetch.mjs')
)) as FetchModule

let folder = ''
afterEach(() => {
  if (folder) fs.rmSync(folder, { recursive: true, force: true })
})

// A temporary project: {tmp}/resources/ffmpeg, and an outside folder a link could point to.
function project() {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'fetch-'))
  const outside = path.join(folder, 'outside')
  fs.mkdirSync(outside)
  return { ffmpegDir: path.join(folder, 'resources', 'ffmpeg'), outside }
}

function builtIn(work: string): string {
  const built = path.join(work, 'ffmpeg-built')
  fs.writeFileSync(built, 'stand-in binary')
  return built
}

describe('refuseRoot [P7-3]', () => {
  it('refuses the root account', () => {
    expect(() => refuseRoot(() => 0)).toThrow(/root/)
  })

  it('lets an ordinary account and a system with no getuid go on', () => {
    expect(() => refuseRoot(() => 501)).not.toThrow()
    expect(() => refuseRoot(undefined)).not.toThrow()
  })
})

describe.skipIf(process.platform === 'win32')('folder checks [P7-3]', () => {
  it('realFolder makes a missing folder', () => {
    const { ffmpegDir } = project()
    realFolder(ffmpegDir)
    expect(fs.lstatSync(ffmpegDir).isDirectory()).toBe(true)
  })

  it('realFolder refuses a link to a folder', () => {
    const { ffmpegDir, outside } = project()
    fs.mkdirSync(path.dirname(ffmpegDir))
    fs.symlinkSync(outside, ffmpegDir)
    expect(() => realFolder(ffmpegDir)).toThrow(/plain folder/)
  })

  it('freshWork refuses when resources/ffmpeg is a link', () => {
    const { ffmpegDir, outside } = project()
    fs.mkdirSync(path.dirname(ffmpegDir))
    fs.symlinkSync(outside, ffmpegDir)
    expect(() => freshWork(ffmpegDir)).toThrow(/plain folder/)
    expect(fs.readdirSync(outside)).toEqual([])
  })

  it('freshWork refuses when .work is a link and leaves its target alone', () => {
    const { ffmpegDir, outside } = project()
    fs.mkdirSync(ffmpegDir, { recursive: true })
    fs.writeFileSync(path.join(outside, 'keep.txt'), 'keep')
    fs.symlinkSync(outside, path.join(ffmpegDir, '.work'))
    expect(() => freshWork(ffmpegDir)).toThrow(/plain folder/)
    expect(fs.readFileSync(path.join(outside, 'keep.txt'), 'utf8')).toBe('keep')
  })

  it('freshWork empties a left-over .work folder', () => {
    const { ffmpegDir } = project()
    fs.mkdirSync(path.join(ffmpegDir, '.work'), { recursive: true })
    fs.writeFileSync(path.join(ffmpegDir, '.work', 'old'), 'x')
    const work = freshWork(ffmpegDir)
    expect(work).toBe(path.join(ffmpegDir, '.work'))
    expect(fs.readdirSync(work)).toEqual([])
  })
})

describe.skipIf(process.platform === 'win32')('install [P7-3]', () => {
  it.each([
    ['darwin-arm64', 'ffmpeg'],
    ['win32-x64', 'ffmpeg.exe'],
  ])('copies the binary to %s/%s with mode 755', (key, name) => {
    const { ffmpegDir } = project()
    const work = freshWork(ffmpegDir)
    const dest = install(builtIn(work), ffmpegDir, key)
    expect(dest).toBe(path.join(ffmpegDir, key, name))
    expect(fs.readFileSync(dest, 'utf8')).toBe('stand-in binary')
    expect(fs.statSync(dest).mode & 0o777).toBe(0o755)
  })

  it('refuses a built binary that is a link', () => {
    const { ffmpegDir, outside } = project()
    const work = freshWork(ffmpegDir)
    const link = path.join(work, 'ffmpeg-built')
    fs.writeFileSync(path.join(outside, 'real'), 'x')
    fs.symlinkSync(path.join(outside, 'real'), link)
    expect(() => install(link, ffmpegDir, 'darwin-arm64')).toThrow(/plain file/)
    expect(fs.existsSync(path.join(ffmpegDir, 'darwin-arm64', 'ffmpeg'))).toBe(false)
  })

  it('refuses a ship folder that is a link', () => {
    const { ffmpegDir, outside } = project()
    const work = freshWork(ffmpegDir)
    fs.symlinkSync(outside, path.join(ffmpegDir, 'darwin-arm64'))
    expect(() => install(builtIn(work), ffmpegDir, 'darwin-arm64')).toThrow(/plain folder/)
    expect(fs.readdirSync(outside)).toEqual([])
  })

  it('replaces a link at the ship path without writing through it', () => {
    const { ffmpegDir, outside } = project()
    const work = freshWork(ffmpegDir)
    const target = path.join(outside, 'victim')
    fs.writeFileSync(target, 'untouched')
    fs.mkdirSync(path.join(ffmpegDir, 'darwin-arm64'))
    const dest = path.join(ffmpegDir, 'darwin-arm64', 'ffmpeg')
    fs.symlinkSync(target, dest)
    install(builtIn(work), ffmpegDir, 'darwin-arm64')
    expect(fs.lstatSync(dest).isFile()).toBe(true)
    expect(fs.readFileSync(target, 'utf8')).toBe('untouched')
  })
})

describe.skipIf(process.platform === 'win32')('fetchFfmpeg: check first, then ship [P7-3]', () => {
  const key = 'darwin-arm64'

  it('checks the binary inside .work before anything is at the ship path', async () => {
    const { ffmpegDir } = project()
    const shipPath = path.join(ffmpegDir, key, 'ffmpeg')
    const checked: string[] = []
    const check = async (binary: string): Promise<Verdict> => {
      checked.push(binary)
      expect(fs.existsSync(shipPath)).toBe(false)
      return { ok: true }
    }
    const dest = await fetchFfmpeg({ ffmpegDir, key, getBinary: async (w) => builtIn(w), check })
    expect(dest).toBe(shipPath)
    expect(checked).toEqual([path.join(ffmpegDir, '.work', 'ffmpeg-built')])
    expect(fs.readFileSync(shipPath, 'utf8')).toBe('stand-in binary')
    expect(fs.existsSync(path.join(ffmpegDir, '.work'))).toBe(false)
  })

  it('a failed licence check leaves nothing at the ship path and no .work', async () => {
    const { ffmpegDir } = project()
    const check = async (): Promise<Verdict> => ({ ok: false, reason: 'it names the GPL' })
    await expect(
      fetchFfmpeg({ ffmpegDir, key, getBinary: async (w) => builtIn(w), check }),
    ).rejects.toThrow(/licence check failed: it names the GPL/)
    expect(fs.existsSync(path.join(ffmpegDir, key, 'ffmpeg'))).toBe(false)
    expect(fs.existsSync(path.join(ffmpegDir, '.work'))).toBe(false)
  })

  it('a failed build leaves no .work and never runs the check', async () => {
    const { ffmpegDir } = project()
    const checked: string[] = []
    const getBinary = async (work: string): Promise<string> => {
      fs.writeFileSync(path.join(work, 'half-built'), 'x')
      throw new Error('make ended with code 2')
    }
    const check = async (binary: string): Promise<Verdict> => {
      checked.push(binary)
      return { ok: true }
    }
    await expect(fetchFfmpeg({ ffmpegDir, key, getBinary, check })).rejects.toThrow(/make/)
    expect(checked).toEqual([])
    expect(fs.existsSync(path.join(ffmpegDir, '.work'))).toBe(false)
  })

  it('does not delete .work when it was swapped for a link during the run', async () => {
    const { ffmpegDir, outside } = project()
    fs.writeFileSync(path.join(outside, 'keep.txt'), 'keep')
    const getBinary = async (work: string): Promise<string> => {
      fs.rmSync(work, { recursive: true })
      fs.symlinkSync(outside, work)
      throw new Error('stopped')
    }
    const check = async (): Promise<Verdict> => ({ ok: true })
    await expect(fetchFfmpeg({ ffmpegDir, key, getBinary, check })).rejects.toThrow()
    expect(fs.readFileSync(path.join(outside, 'keep.txt'), 'utf8')).toBe('keep')
  })
})
