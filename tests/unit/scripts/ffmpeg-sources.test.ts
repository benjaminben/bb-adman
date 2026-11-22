import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'

type Sources = {
  version: string
  windows: { url: string; sha256: string; member: string }
  source: { url: string; sha256: string; configure: string[] }
}
type SourcesModule = {
  checkSources: (value: unknown) => Sources
  checkUrl: (value: string, hosts: readonly string[]) => URL
  LISTED_HOSTS: readonly string[]
}

const modulePath = path.resolve('scripts/ffmpeg/sources.mjs')
const { checkSources, checkUrl, LISTED_HOSTS } = (await import(
  /* @vite-ignore */ modulePath
)) as SourcesModule

const committed = JSON.parse(fs.readFileSync('scripts/ffmpeg-sources.json', 'utf8')) as Sources
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')) as {
  scripts: Record<string, string>
}

// A deep copy of the committed file with one value changed.
function changed(edit: (s: Sources) => void): Sources {
  const copy = structuredClone(committed)
  edit(copy)
  return copy
}

const hash = 'a'.repeat(64)

describe('scripts/ffmpeg-sources.json [P7-3, OI-09]', () => {
  it('the committed file passes the check', () => {
    expect(checkSources(committed)).toEqual(committed)
  })

  it('pins the builder release on GitHub and the source archive on ffmpeg.org', () => {
    expect(new URL(committed.windows.url).hostname).toBe('github.com')
    expect(committed.windows.url).toMatch(/win64-lgpl/)
    expect(new URL(committed.source.url).hostname).toBe('ffmpeg.org')
  })

  it('builds without GPL or non-free parts and with the test clip parts', () => {
    const flags = committed.source.configure
    expect(flags).toEqual(expect.arrayContaining(['--disable-gpl', '--disable-nonfree']))
    expect(flags).toEqual(
      expect.arrayContaining([
        '--disable-network',
        '--disable-autodetect',
        '--disable-doc',
        '--disable-ffplay',
        '--disable-ffprobe',
        '--enable-videotoolbox',
        '--enable-indev=lavfi',
      ]),
    )
    expect(flags.join(' ')).not.toMatch(/--enable-(gpl|nonfree)\b/)
  })

  // What the app's own FFmpeg arguments ask for: export (encoder-args.ts, still-args.ts,
  // filter-graph.ts), the details embed (P7-4), sound in export (P8-17) and the test clips.
  const needed: [string, string[]][] = [
    ['demuxer', ['mov', 'matroska', 'image2', 'image2pipe', 'ffmetadata', 'mp3', 'wav', 'aac']],
    ['muxer', ['mp4', 'mov', 'image2pipe']],
    [
      'decoder',
      [
        'h264',
        'hevc',
        'vp8',
        'vp9',
        'prores',
        'png',
        'mjpeg',
        'webp',
        'rawvideo',
        'wrapped_avframe',
      ].concat([
        'aac',
        'mp3float',
        'alac',
        'opus',
        'vorbis',
        'pcm_s16le',
        'pcm_s24le',
        'pcm_f32le',
      ]),
    ],
    ['encoder', ['h264_videotoolbox', 'aac_at', 'aac', 'png']],
    ['parser', ['h264', 'hevc', 'aac', 'mjpeg', 'png', 'mpegaudio', 'opus', 'vorbis']],
    ['bsf', ['aac_adtstoasc']],
    ['protocol', ['file', 'pipe']],
    [
      'filter',
      ['color', 'trim', 'scale', 'crop', 'overlay', 'format', 'setpts', 'fps', 'loop'].concat([
        'anullsrc',
        'aresample',
        'atrim',
        'asetpts',
        'adelay',
        'apad',
        'concat',
      ]),
    ],
    ['indev', ['lavfi']],
  ]

  it.each(needed)('enables every %s the app asks for', (kind, names) => {
    const prefix = `--enable-${kind}=`
    const flag = committed.source.configure.find((f) => f.startsWith(prefix))
    const enabled = flag?.slice(prefix.length).split(',') ?? []
    expect(enabled).toEqual(expect.arrayContaining(names))
  })

  it('enables the system zlib, which the PNG decoder and encoder need', () => {
    expect(committed.source.configure).toContain('--enable-zlib')
  })

  it.each([
    ['an http: address', (s: Sources) => (s.windows.url = s.windows.url.replace('https', 'http'))],
    ['an unlisted host', (s: Sources) => (s.source.url = 'https://example.com/ffmpeg-1.0.tar.xz')],
    ['a listed host with a user name', (s: Sources) => (s.source.url = 'https://a@ffmpeg.org/x')],
    ['a listed host with a port', (s: Sources) => (s.source.url = 'https://ffmpeg.org:8443/x')],
    [
      'a source address outside /releases/',
      (s: Sources) => (s.source.url = 'https://ffmpeg.org/other/ffmpeg-9.0.2.tar.xz'),
    ],
    [
      'a windows address outside the builder repository',
      (s: Sources) =>
        (s.windows.url =
          'https://github.com/someone/else/releases/download/x/ffmpeg-win64-lgpl.zip'),
    ],
    ['a short hash', (s: Sources) => (s.windows.sha256 = 'abc123')],
    ['a hash with capitals', (s: Sources) => (s.source.sha256 = 'A'.repeat(64))],
    ['a member with ..', (s: Sources) => (s.windows.member = '../x')],
    ['a member with .. inside', (s: Sources) => (s.windows.member = 'a/../../x')],
    ['an absolute member', (s: Sources) => (s.windows.member = '/abs')],
    ['a member with a backslash', (s: Sources) => (s.windows.member = 'a\\b.exe')],
    ['a member that reads as an option', (s: Sources) => (s.windows.member = '--to-command=x')],
    ['a member with a glob character', (s: Sources) => (s.windows.member = 'a/*.exe')],
    ['a configure flag with a space', (s: Sources) => s.source.configure.push('--cc=a b')],
    ['a configure flag naming a program', (s: Sources) => s.source.configure.push('--cc=evil')],
    ['a configure flag with a path', (s: Sources) => s.source.configure.push('--enable-x=/tmp')],
    ['--enable-gpl', (s: Sources) => s.source.configure.push('--enable-gpl')],
    ['--enable-nonfree', (s: Sources) => s.source.configure.push('--enable-nonfree')],
    [
      'no --disable-gpl',
      (s: Sources) =>
        (s.source.configure = s.source.configure.filter((f) => f !== '--disable-gpl')),
    ],
    ['a version with letters', (s: Sources) => (s.version = '9.0; rm')],
    ['a source archive of another version', (s: Sources) => (s.version = '1.2.3')],
    ['a missing windows part', (s: Sources) => delete (s as Partial<Sources>).windows],
  ])('refuses %s', (_name, edit) => {
    expect(() => checkSources(changed(edit))).toThrow()
  })

  it('refuses a non-object', () => {
    expect(() => checkSources('x')).toThrow()
    expect(() => checkSources(null)).toThrow()
  })

  it('the listed hosts are the builder release and download hosts and ffmpeg.org only', () => {
    expect([...LISTED_HOSTS].sort()).toEqual(
      ['ffmpeg.org', 'github.com', 'release-assets.githubusercontent.com'].sort(),
    )
    // GitHub's release downloads go to release-assets (seen on the pinned file); the older
    // download host is not needed, so it is refused.
    expect(() => checkUrl('https://objects.githubusercontent.com/x', LISTED_HOSTS)).toThrow()
    expect(() => checkUrl(`https://github.com.example.com/x?h=${hash}`, LISTED_HOSTS)).toThrow()
    expect(() => checkUrl('https://ffmpeg.org./x', LISTED_HOSTS)).toThrow()
    expect(checkUrl('https://release-assets.githubusercontent.com/x', LISTED_HOSTS).hostname).toBe(
      'release-assets.githubusercontent.com',
    )
  })
})

describe('the fetch never runs at install time [P7-3]', () => {
  it('is one script line, fetch:ffmpeg', () => {
    expect(pkg.scripts['fetch:ffmpeg']).toBe('node scripts/ffmpeg/fetch.mjs')
  })

  it.each(['preinstall', 'install', 'postinstall', 'prepare', 'prepublish', 'prepack'])(
    'has no %s script that fetches FFmpeg',
    (name) => {
      expect(pkg.scripts[name] ?? '').not.toMatch(/ffmpeg|fetch/i)
    },
  )
})
