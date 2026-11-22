// P8-17: the video ad's argument list maps the chosen sound source, or -an.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { videoArgs, type VideoAdSpec, type VideoClip } from '@/main/export/video/encoder-args'
import { assertSafeGraph } from '@/main/export/video/filter-graph'

const workDir = path.resolve('/work/export-work/01HZZZZZZZZZZZZZZZZZZZZZZZ')
const clip: VideoClip = {
  path: path.join(workDir, 'clip-0.mp4'),
  fileType: 'mp4',
  source: { width: 1920, height: 1080 },
  startMs: 1000,
  inMs: 0,
  outMs: 1000,
  placement: null,
  sound: true,
}

function spec(over: Partial<VideoAdSpec>): VideoAdSpec {
  return {
    platform: 'darwin',
    size: { width: 1080, height: 1920 },
    durationMs: 2000,
    fps: 30,
    background: { x: 0, y: 0, width: 1080, height: 1920, rotation: 0, crop: null },
    clips: [clip],
    workDir,
    ...over,
  }
}

const after = (args: string[], flag: string) => args[args.indexOf(flag) + 1]
const inputs = (args: string[]) => args.flatMap((a, i) => (args[i - 1] === '-i' ? [a] : []))

describe('videoArgs sound [P8-17]', () => {
  it.each<[string, VideoAdSpec['sound']]>([
    ['no sound given', undefined],
    ['none', { source: 'none' }],
  ])('%s: -an, no sound input', (_, sound) => {
    const args = videoArgs(spec({ sound }))
    expect(args).toContain('-an')
    expect(inputs(args)).toHaveLength(2)
    expect(args.some((a) => a.includes(':a'))).toBe(false)
  })

  it("clips: the clip's sound in the graph, mapped and encoded, before the work file", () => {
    const args = videoArgs(spec({ sound: { source: 'clips' } }))
    expect(args).not.toContain('-an')
    expect(inputs(args)).toEqual(['pipe:0', `file:${clip.path}`, `file:${clip.path}`])
    const graph = after(args, '-filter_complex') ?? ''
    expect(graph.split(';').at(-1)).toBe('[2:a]adelay=delays=1000:all=1[aout]')
    assertSafeGraph(graph)
    expect(args.join(' ')).toContain('-map [out] -map [aout] -c:a aac')
    expect(args.at(-1)).toBe(`file:${path.join(workDir, 'ad.mp4')}`)
  })

  it('file: the added file is the last input, mapped as it is, cut at the ad end', () => {
    const file = path.join(workDir, 'sound.wav')
    const args = videoArgs(spec({ sound: { source: 'file', path: file, fileType: 'wav' } }))
    expect(args).not.toContain('-an')
    expect(inputs(args).at(-1)).toBe(`file:${file}`)
    const at = args.indexOf(`file:${file}`)
    expect(args.slice(at - 7, at - 1)).toEqual([
      '-protocol_whitelist',
      'file,pipe',
      '-f',
      'wav',
      '-t',
      '2.000',
    ])
    expect(args.join(' ')).toContain('-map [out] -map 2:a:0 -c:a aac')
  })
})
