// P8-15 (security class): the FFmpeg argument list of a video ad. Always an array; every input is
// `file:` plus an absolute path after `-protocol_whitelist file,pipe` and a pinned demuxer; the
// output is the work file (spec/phases/phase-08.md "Video").
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  videoArgs,
  workVideoPath,
  type VideoAdSpec,
  type VideoClip,
} from '@/main/export/video/encoder-args'
import { assertSafeGraph } from '@/main/export/video/filter-graph'
import { AD_FAILURES } from '@/shared/export/messages'

const workDir = path.resolve('/work/export-work/01HZZZZZZZZZZZZZZZZZZZZZZZ')

function clip(over: Partial<VideoClip>): VideoClip {
  return {
    path: path.resolve('/media/clip.mp4'),
    fileType: 'mp4',
    source: { width: 1920, height: 1080 },
    startMs: 0,
    inMs: 1500,
    outMs: 4500,
    placement: null,
    ...over,
  }
}

function spec(over: Partial<VideoAdSpec> = {}): VideoAdSpec {
  return {
    platform: 'darwin',
    size: { width: 1080, height: 1920 },
    durationMs: 15000,
    fps: 30,
    background: { x: 0, y: 0, width: 1080, height: 1920, rotation: 0, crop: null },
    clips: [],
    workDir,
    ...over,
  }
}

// The arguments between one `-i` and the one before it, with the `-i` value.
function inputs(args: string[]): Array<{ options: string[]; value: string }> {
  const out: Array<{ options: string[]; value: string }> = []
  let from = 0
  args.forEach((arg, i) => {
    if (arg !== '-i') return
    out.push({ options: args.slice(from, i), value: nth(args, i + 1) })
    from = i + 2
  })
  return out
}

// Item n of a list, failing the test when it is not there.
function nth<T>(list: T[], n: number): T {
  const item = list[n]
  if (item === undefined) throw new Error(`No item ${n}.`)
  return item
}

function after(args: string[], flag: string): string {
  return nth(args, args.indexOf(flag) + 1)
}

// The value of the last use of a flag: the output options come after every input's.
function last(args: string[], flag: string): string {
  return nth(args, args.lastIndexOf(flag) + 1)
}

const twoClips = [
  clip({}),
  clip({
    path: path.resolve('/media/logo.png'),
    fileType: 'png',
    startMs: 5000,
    inMs: 0,
    outMs: 3000,
  }),
]

describe('videoArgs encoders [P8-15]', () => {
  it.each([
    { platform: 'darwin' as const, encoder: 'h264_videotoolbox' },
    { platform: 'win32' as const, encoder: 'h264_mf' },
  ])('uses $encoder on $platform', ({ platform, encoder }) => {
    const args = videoArgs(spec({ platform }))
    expect(last(args, '-c:v')).toBe(encoder)
    expect(after(args, '-b:v')).toBe('12M')
  })

  it.each(['linux', 'freebsd'] as const)('refuses %s with the sentence', (platform) => {
    expect(() => videoArgs(spec({ platform }))).toThrow(AD_FAILURES.videoSystem)
  })

  it('sets the common output options and no sound', () => {
    const args = videoArgs(spec({ fps: 60 }))
    expect(after(args, '-pix_fmt')).toBe('yuv420p')
    expect(after(args, '-r')).toBe('60')
    expect(after(args, '-movflags')).toBe('+faststart')
    expect(args).toContain('-an')
    expect(after(args, '-map')).toBe('[out]')
  })
})

describe('videoArgs inputs [P8-15]', () => {
  it('reads the frame stream from pipe:0 as PNG at the frame rate', () => {
    const frames = nth(inputs(videoArgs(spec())), 0)
    expect(frames.value).toBe('pipe:0')
    expect(frames.options).toEqual([
      ...frames.options.slice(0, frames.options.indexOf('-protocol_whitelist')),
      '-protocol_whitelist',
      'file,pipe',
      '-f',
      'image2pipe',
      '-framerate',
      '30',
      '-c:v',
      'png',
    ])
  })

  it('gives every input the whitelist, a pinned demuxer and a file: path', () => {
    const list = inputs(videoArgs(spec({ clips: twoClips })))
    expect(list).toHaveLength(3)
    for (const { options, value } of list) {
      expect(after(options, '-protocol_whitelist')).toBe('file,pipe')
      expect(options).toContain('-f')
      expect(value === 'pipe:0' || value.startsWith('file:')).toBe(true)
    }
    expect(list[1]).toEqual({
      options: [
        '-protocol_whitelist',
        'file,pipe',
        '-f',
        'mov',
        '-ss',
        '1.500',
        '-t',
        '3.000',
        '-itsoffset',
        '0.000',
      ],
      value: `file:${nth(twoClips, 0).path}`,
    })
    expect(list[2]).toEqual({
      options: [
        '-protocol_whitelist',
        'file,pipe',
        '-f',
        'image2',
        '-pattern_type',
        'none',
        '-loop',
        '1',
        '-framerate',
        '30',
        '-t',
        '3.000',
        '-itsoffset',
        '5.000',
      ],
      value: `file:${nth(twoClips, 1).path}`,
    })
  })

  it.each([
    { fileType: 'mov' as const, demuxer: 'mov' },
    { fileType: 'webm' as const, demuxer: 'matroska' },
    { fileType: 'jpeg' as const, demuxer: 'image2' },
    { fileType: 'webp' as const, demuxer: 'image2' },
  ])('pins the $demuxer demuxer for $fileType', ({ fileType, demuxer }) => {
    const list = inputs(videoArgs(spec({ clips: [clip({ fileType })] })))
    expect(after(nth(list, 1).options, '-f')).toBe(demuxer)
  })

  it.each([
    path.resolve('/media/-i evil.mp4'),
    path.resolve('/media/a:b|c.mp4'),
    path.resolve('/media/movie=x;[a].mp4'),
  ])('keeps the path %s as one argument and out of the graph', (file) => {
    const args = videoArgs(spec({ clips: [clip({ path: file })] }))
    expect(nth(inputs(args), 1).value).toBe(`file:${file}`)
    expect(args.filter((a) => a.includes(file))).toEqual([`file:${file}`])
    expect(() => assertSafeGraph(after(args, '-filter_complex'))).not.toThrow()
  })

  it.each(['-filter_complex', 'media/clip.mp4', 'file:/media/clip.mp4', ''])(
    'refuses the path %j that is not absolute',
    (file) => {
      expect(() => videoArgs(spec({ clips: [clip({ path: file })] }))).toThrow()
    },
  )

  it('leaves a clip outside the ad out of the inputs too', () => {
    const late = clip({ path: path.resolve('/media/late.mp4'), startMs: 15000 })
    const args = videoArgs(spec({ clips: [clip({}), late] }))
    expect(inputs(args)).toHaveLength(2)
    expect(args.join(' ')).not.toContain('late.mp4')
  })
})

describe('videoArgs output [P8-15]', () => {
  it('writes only the work file inside the work folder, as mp4, never overwriting', () => {
    const args = videoArgs(spec({ clips: twoClips }))
    const out = args[args.length - 1]
    expect(out).toBe(`file:${workVideoPath(workDir)}`)
    const relative = path.relative(workDir, workVideoPath(workDir))
    expect(relative.startsWith('..') || path.isAbsolute(relative)).toBe(false)
    expect(args.slice(-3, -1)).toEqual(['-f', 'mp4'])
    expect(args).toContain('-n')
    expect(args).not.toContain('-y')
  })

  it('refuses a work folder that is not absolute', () => {
    expect(() => videoArgs(spec({ workDir: 'export-work/x' }))).toThrow()
    expect(() => workVideoPath('../out')).toThrow()
  })

  it('passes a safe filter graph', () => {
    const graph = after(videoArgs(spec({ clips: twoClips })), '-filter_complex')
    expect(() => assertSafeGraph(graph)).not.toThrow()
  })
})
