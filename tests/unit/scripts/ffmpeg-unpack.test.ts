import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'

type RunResult = { code: number; stdout: string }
type Run = (command: string, args: string[], options?: object) => Promise<RunResult>
type UnpackModule = {
  checkMembers: (names: string[], types: string[], top: string) => void
  unpack: (options: {
    archive: string
    sha256: string
    into: string
    top: string
    members?: string[]
    runImpl?: Run
  }) => Promise<void>
  TAR: string
}
type RunModule = { run: Run }

const { checkMembers, unpack, TAR } = (await import(
  /* @vite-ignore */ path.resolve('scripts/ffmpeg/unpack.mjs')
)) as UnpackModule
const { run } = (await import(
  /* @vite-ignore */ path.resolve('scripts/ffmpeg/run.mjs')
)) as RunModule

let folder = ''
afterEach(() => {
  if (folder) fs.rmSync(folder, { recursive: true, force: true })
})

function tempFolder(): string {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'unpack-'))
  return folder
}

const top = 'ffmpeg-9.0.2'

describe('checkMembers: nothing lands outside the work folder [P7-3]', () => {
  it('passes plain files and folders under the expected top folder', () => {
    expect(() =>
      checkMembers([`${top}/`, `${top}/configure`, `${top}/libavcodec/a.c`], ['d', '-', '-'], top),
    ).not.toThrow()
  })

  it.each([
    ['a .. member', [`${top}/../evil`], ['-']],
    ['a .. member at the start', ['../evil'], ['-']],
    ['an absolute member', ['/etc/evil'], ['-']],
    ['a backslash member', [`${top}\\..\\evil`], ['-']],
    ['a member outside the top folder', ['other/file'], ['-']],
    ['a top-folder look-alike', [`${top}x/file`], ['-']],
    ['a symbolic link', [`${top}/link`], ['l']],
    ['a hard link', [`${top}/link`], ['h']],
    ['a device', [`${top}/dev`], ['c']],
    ['listings of different lengths (a name with a line break)', [`${top}/a`, `${top}/b`], ['-']],
    ['an empty archive', [], []],
  ])('refuses %s', (_name, names, types) => {
    expect(() => checkMembers(names, types, top)).toThrow()
  })
})

describe('unpack [P7-3]', () => {
  it('checks the SHA-256 before running tar at all', async () => {
    const dir = tempFolder()
    const archive = path.join(dir, 'a.tar')
    fs.writeFileSync(archive, 'changed bytes')
    const calls: string[][] = []
    const runImpl: Run = async (command, args) => {
      calls.push([command, ...args])
      return { code: 0, stdout: '' }
    }
    await expect(
      unpack({ archive, sha256: 'c'.repeat(64), into: dir, top, runImpl }),
    ).rejects.toThrow(/SHA-256/)
    expect(calls).toEqual([])
  })

  it.skipIf(process.platform === 'win32')(
    'refuses a real archive holding a symbolic link and writes nothing',
    async () => {
      const dir = tempFolder()
      const made = path.join(dir, 'made')
      fs.mkdirSync(path.join(made, top), { recursive: true })
      fs.writeFileSync(path.join(made, top, 'configure'), 'x')
      fs.symlinkSync('/etc', path.join(made, top, 'escape'))
      const archive = path.join(dir, 'a.tar')
      spawnSync(TAR, ['-cf', archive, '-C', made, top], { shell: false })
      const sha256 = crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex')
      const into = path.join(dir, 'into')
      fs.mkdirSync(into)
      await expect(unpack({ archive, sha256, into, top })).rejects.toThrow(/link/)
      expect(fs.readdirSync(into)).toEqual([])
    },
  )

  it.skipIf(process.platform === 'win32')(
    'unpacks a plain archive with tar run from a fixed path',
    async () => {
      const dir = tempFolder()
      const made = path.join(dir, 'made')
      fs.mkdirSync(path.join(made, top, 'bin'), { recursive: true })
      fs.writeFileSync(path.join(made, top, 'bin', 'ffmpeg.exe'), 'x')
      fs.writeFileSync(path.join(made, top, 'LICENSE.txt'), 'y')
      const archive = path.join(dir, 'a.tar')
      spawnSync(TAR, ['-cf', archive, '-C', made, top], { shell: false })
      const sha256 = crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex')
      const into = path.join(dir, 'into')
      fs.mkdirSync(into)
      const member = `${top}/bin/ffmpeg.exe`
      await unpack({ archive, sha256, into, top, members: [member] })
      expect(fs.readFileSync(path.join(into, member), 'utf8')).toBe('x')
      expect(fs.existsSync(path.join(into, top, 'LICENSE.txt'))).toBe(false)
    },
  )

  it('refuses a named member the archive does not hold', async () => {
    const dir = tempFolder()
    const archive = path.join(dir, 'a.tar')
    fs.writeFileSync(archive, 'bytes')
    const sha256 = crypto.createHash('sha256').update('bytes').digest('hex')
    const runImpl: Run = async (_command, args) => ({
      code: 0,
      stdout: args.includes('-tvf') ? '-rw-r--r-- 0 0 0 1 Nov 21 04:31 x\n' : `${top}/a\n`,
    })
    await expect(
      unpack({ archive, sha256, into: dir, top, members: [`${top}/bin/ffmpeg.exe`], runImpl }),
    ).rejects.toThrow(/not in the archive/)
  })
})

describe('run: no shell and no PATH lookup [P7-3]', () => {
  it.each(['tar', './configure', 'bin/ffmpeg'])('refuses the command %s', async (command) => {
    await expect(run(command, [])).rejects.toThrow(/absolute/)
  })

  it.skipIf(process.platform === 'win32')(
    'passes arguments as they are, not through a shell',
    async () => {
      const result = await run('/bin/echo', ['$HOME', '; ls', '`id`'])
      expect(result).toEqual({ code: 0, stdout: '$HOME ; ls `id`\n' })
    },
  )
})
