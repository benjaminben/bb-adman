// P8-17 (security class short): the sound part of a video ad's FFmpeg arguments
// (spec/export-and-checks.md "Sound in export"; CQ-32 as ruled for this slice). One source:
// 'none' is silent (-an); 'clips' is each clip's own sound where it is on, placed at the clip's
// time; 'file' is the added audio file from 0, cut at the ad's end with -t. Every sound input is
// `-protocol_whitelist file,pipe`, a pinned demuxer and `file:` with an absolute path.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { VideoClip } from '@/main/export/video/encoder-args'
import { assertSafeGraph, planClips } from '@/main/export/video/filter-graph'
import { soundArgs, type AdSound } from '@/main/export/video/sound-args'

const background = { x: 0, y: 0, width: 1080, height: 1920, rotation: 0, crop: null }
const AAC = ['-c:a', 'aac', '-b:a', '192k']

function clip(over: Partial<VideoClip>): VideoClip {
  return {
    path: path.resolve('/work/clip-0.mp4'),
    fileType: 'mp4',
    source: { width: 1920, height: 1080 },
    startMs: 0,
    inMs: 0,
    outMs: 1000,
    placement: null,
    ...over,
  }
}

function args(sound: AdSound, clips: VideoClip[] = [], durationMs = 4000) {
  const planned = planClips(
    clips.map((c) => ({ ...c, still: c.fileType === 'png' })),
    background,
    durationMs,
  )
  return soundArgs(sound, planned, durationMs)
}

const input = (demuxer: string, read: string[], file: string) => [
  '-protocol_whitelist',
  'file,pipe',
  '-f',
  demuxer,
  ...read,
  '-i',
  `file:${path.resolve(file)}`,
]

describe('soundArgs [P8-17]', () => {
  it('none: silent, with no input and no graph', () => {
    const clips = [clip({ sound: true })]
    expect(args({ source: 'none' }, clips)).toEqual({ inputs: [], graph: [], output: ['-an'] })
  })

  it.each<[string, VideoClip[]]>([
    ['no clip', []],
    ['a clip with its sound off', [clip({ sound: false })]],
    ['a clip that holds no sound', [clip({})]],
    ['a still', [clip({ fileType: 'png', path: path.resolve('/work/clip-0.png'), sound: true })]],
    ['a clip past the ad end', [clip({ startMs: 5000, sound: true })]],
  ])('clips with %s: silent', (_, clips) => {
    expect(args({ source: 'clips' }, clips)).toEqual({ inputs: [], graph: [], output: ['-an'] })
  })

  it("clips: each clip's own audio, read again from its copy and delayed to its start", () => {
    const clips = [
      clip({ sound: true, inMs: 500, outMs: 1500 }),
      clip({ startMs: 1000, path: path.resolve('/work/clip-1.mov'), fileType: 'mov' }),
      clip({ startMs: 2000, inMs: 250, outMs: 3250, sound: true, path: '/work/clip-2.mp4' }),
    ]
    const got = args({ source: 'clips' }, clips)
    // The frame stream is input 0 and the three clips 1 to 3, so the sound inputs are 4 and 5.
    expect(got.inputs).toEqual([
      ...input('mov', ['-ss', '0.500', '-t', '1.000'], '/work/clip-0.mp4'),
      ...input('mov', ['-ss', '0.250', '-t', '2.000'], '/work/clip-2.mp4'),
    ])
    expect(got.graph).toEqual([
      '[4:a]adelay=delays=0:all=1[s0]',
      '[5:a]adelay=delays=2000:all=1[s1]',
      '[s0][s1]amix=inputs=2:duration=longest:normalize=0[aout]',
    ])
    expect(got.output).toEqual(['-map', '[aout]', ...AAC])
    assertSafeGraph(got.graph.join(';'))
  })

  it('clips: one sounding clip is delayed and mapped alone', () => {
    const got = args({ source: 'clips' }, [clip({ startMs: 1500, sound: true })])
    expect(got.graph).toEqual(['[2:a]adelay=delays=1500:all=1[aout]'])
    expect(got.output).toEqual(['-map', '[aout]', ...AAC])
  })

  it.each([
    ['mp3', 'mp3'],
    ['wav', 'wav'],
    ['m4a', 'mov'],
    ['aac', 'aac'],
  ] as const)('file %s: read with the %s demuxer from 0, cut at the ad end', (type, demuxer) => {
    const file = path.resolve(`/work/sound.${type}`)
    const got = args({ source: 'file', path: file, fileType: type }, [clip({ sound: true })])
    expect(got.inputs).toEqual(input(demuxer, ['-t', '4.000'], file))
    expect(got.graph).toEqual([])
    // The clip is input 1, so the file is input 2; the clip's own sound is not used.
    expect(got.output).toEqual(['-map', '2:a:0', ...AAC])
  })

  it('keeps a path starting with - or holding : or | as one argument, after file:', () => {
    const file = path.resolve('/work/-x:a|b.wav')
    const got = args({ source: 'file', path: file, fileType: 'wav' })
    expect(got.inputs.at(-1)).toBe(`file:${file}`)
  })

  it('refuses a path that is not absolute', () => {
    expect(() => args({ source: 'file', path: 'sound.wav', fileType: 'wav' })).toThrow()
  })
})
