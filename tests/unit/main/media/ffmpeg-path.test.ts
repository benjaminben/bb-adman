import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { binaryUsable, ffmpegPath } from '@/main/media/ffmpeg-path'

describe('ffmpegPath (phase-07.md, "How FFmpeg is run")', () => {
  it.each([
    [true, 'darwin', 'arm64', '/App/Resources/ffmpeg/darwin-arm64/ffmpeg'],
    [true, 'darwin', 'x64', '/App/Resources/ffmpeg/darwin-x64/ffmpeg'],
    [true, 'win32', 'x64', '/App/Resources/ffmpeg/win32-x64/ffmpeg.exe'],
    [false, 'darwin', 'arm64', '/repo/resources/ffmpeg/darwin-arm64/ffmpeg'],
    [false, 'darwin', 'x64', '/repo/resources/ffmpeg/darwin-x64/ffmpeg'],
    [false, 'win32', 'x64', '/repo/resources/ffmpeg/win32-x64/ffmpeg.exe'],
  ] as const)('packaged %s on %s %s', (packaged, platform, arch, expected) => {
    const found = ffmpegPath({
      packaged,
      resourcesPath: path.resolve('/App/Resources'),
      appPath: path.resolve('/repo'),
      platform,
      arch,
    })
    expect(found).toBe(path.resolve(expected))
  })
})

describe('binaryUsable', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-ffpath-'))
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }))
  const file = path.join(dir, 'ffmpeg')
  fs.writeFileSync(file, 'x')
  const link = path.join(dir, 'link')
  fs.symlinkSync(file, link)
  const folder = path.join(dir, 'folder')
  fs.mkdirSync(folder)

  it('accepts a regular file', async () => {
    expect(await binaryUsable(file)).toBe(true)
  })

  it.each([
    ['a link', link],
    ['a folder', folder],
    ['a missing file', path.join(dir, 'missing')],
  ])('refuses %s', async (_name, target) => {
    expect(await binaryUsable(target)).toBe(false)
  })
})
