import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ffmpegPath } from '@/main/media/ffmpeg-path'

type Resource = { from: string; to: string; filter?: string[] }
type Fuses = Record<string, boolean>
type BuilderConfig = { extraResources?: Resource[]; electronFuses?: Fuses; asarUnpack: string[] }
type Sources = { version: string; source: { url: string; sha256: string; configure: string[] } }

const config = JSON.parse(fs.readFileSync('electron-builder.json', 'utf8')) as BuilderConfig
const sources = JSON.parse(fs.readFileSync('scripts/ffmpeg-sources.json', 'utf8')) as Sources
const notices = fs.readFileSync('THIRD-PARTY-NOTICES.md', 'utf8')

// electron-builder's own macros: ${platform} is process.platform, ${arch} is process.arch.
function expand(text: string, platform: string, arch: string): string {
  return text.replaceAll('${platform}', platform).replaceAll('${arch}', arch)
}

describe('FFmpeg in the package [P8-18, FR-143]', () => {
  it("carries only the platform's own FFmpeg folder", () => {
    expect(config.extraResources).toEqual([
      { from: 'resources/ffmpeg/${platform}-${arch}', to: 'ffmpeg/${platform}-${arch}' },
    ])
  })

  it.each([
    ['darwin', 'arm64', 'ffmpeg'],
    ['darwin', 'x64', 'ffmpeg'],
    ['win32', 'x64', 'ffmpeg.exe'],
  ] as const)('the locator finds the packaged copy on %s %s', (platform, arch, name) => {
    const resourcesPath = path.resolve('/Adman.app/Contents/Resources')
    const to = expand(config.extraResources?.[0]?.to ?? '', platform, arch)
    const place = { resourcesPath, appPath: path.resolve('/repo'), platform, arch }
    expect(ffmpegPath({ ...place, packaged: true })).toBe(path.join(resourcesPath, to, name))
    const from = expand(config.extraResources?.[0]?.from ?? '', platform, arch)
    expect(ffmpegPath({ ...place, packaged: false })).toBe(path.join('/repo', from, name))
  })

  describe('the packaged path cannot be steered', () => {
    afterEach(() => vi.unstubAllEnvs())

    it('ignores the environment and PATH', () => {
      const place = {
        packaged: true,
        resourcesPath: path.resolve('/Adman.app/Contents/Resources'),
        appPath: path.resolve('/repo'),
        platform: 'darwin',
        arch: 'arm64',
      } as const
      const before = ffmpegPath(place)
      for (const name of ['FFMPEG_PATH', 'FFMPEG_BIN', 'ADMAN_FFMPEG', 'PATH']) {
        vi.stubEnv(name, '/tmp/elsewhere/ffmpeg')
      }
      expect(ffmpegPath(place)).toBe(before)
    })
  })

  it('never commits the binary', () => {
    const ignore = fs.readFileSync('.gitignore', 'utf8').split('\n')
    expect(ignore).toContain('resources/ffmpeg/')
  })
})

describe('THIRD-PARTY-NOTICES.md, the FFmpeg part [P8-18]', () => {
  it('names the LGPL 2.1 or later and where the full text is', () => {
    expect(notices).toContain('GNU Lesser General Public License')
    expect(notices).toContain('version 2.1 of the License, or (at your option) any later version')
    expect(notices).toContain('https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html')
    expect(notices).toContain('COPYING.LGPLv2.1')
  })

  it('links the matching source, its version and checksum', () => {
    expect(notices).toContain(sources.source.url)
    expect(notices).toContain(sources.source.sha256)
    expect(notices).toContain(`FFmpeg ${sources.version}`)
  })

  it.each(sources.source.configure)('holds the build flag %s', (flag) => {
    expect(notices).toContain(flag)
  })

  it('holds no email address', () => {
    expect(notices).not.toMatch(/[\w.+-]+@[\w-]+\.\w+/)
  })
})

describe('Electron fuses for the packaged app [P8-18 hardening]', () => {
  it('switches off run-as-node, NODE_OPTIONS and the inspect flags, and loads only the asar', () => {
    expect(config.electronFuses).toMatchObject({
      runAsNode: false,
      enableNodeOptionsEnvironmentVariable: false,
      enableNodeCliInspectArguments: false,
      onlyLoadAppFromAsar: true,
    })
  })

  it('keeps native modules unpacked beside the asar', () => {
    expect(config.asarUnpack).toContain('**/*.node')
  })
})
