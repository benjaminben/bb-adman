// The whole FFmpeg argument list of one video ad (spec/export-and-checks.md "Video variant").
// Security (spec/phases/phase-08.md "Video"): always an array, never a shell string. Every input
// is `-protocol_whitelist file,pipe`, a pinned demuxer, then `file:` and an absolute path the
// caller checked (AssetService.resolve, realpath, a regular file); the frame stream is pipe:0.
// The output is the work file in the work folder; FFmpeg is never given the output folder.
// P8-17: the sound inputs, graph and mapping come from sound-args.ts; with none, -an.
import path from 'node:path'
import { AD_FAILURES } from '@/shared/export/messages'
import type { Size } from '@/shared/scene/background-placement'
import type { Geometry } from '@/shared/schemas/layer'
import {
  assertSafeGraph,
  filterGraph,
  planClips,
  seconds,
  whole,
  type GraphClip,
  type PlannedClip,
} from './filter-graph'
import { soundArgs, type AdSound } from './sound-args'
import { CLIP_DEMUXERS, type ClipFileType } from './clip-demuxers'

export type { ClipFileType }

export type VideoClip = Omit<GraphClip, 'still'> & {
  path: string
  // The asset's sniffed type (src/shared/config/file-types.ts); it picks the demuxer.
  fileType: ClipFileType
  // P8-17: its own sound is heard (its soundOn, and the file holds sound). Absent: silent.
  sound?: boolean
}

export type VideoAdSpec = {
  platform: NodeJS.Platform
  size: Size
  durationMs: number
  fps: 30 | 60
  // The background layer's geometry, for clips with no placement of their own.
  background: Geometry
  clips: VideoClip[]
  workDir: string
  // P8-17: the ad's one sound source; absent = none.
  sound?: AdSound
}

const WORK_VIDEO = 'ad.mp4'
const WHITELIST = ['-protocol_whitelist', 'file,pipe']

const ENCODERS: Partial<Record<NodeJS.Platform, string>> = {
  darwin: 'h264_videotoolbox',
  win32: 'h264_mf',
}

const STILLS: ReadonlySet<ClipFileType> = new Set(['png', 'jpeg', 'webp'])

export function checkedAbsolute(file: string): string {
  if (!path.isAbsolute(file)) throw new Error('FFmpeg is given absolute paths only.')
  return file
}

// The one file FFmpeg writes, inside the job's work folder.
export function workVideoPath(workDir: string): string {
  return path.join(checkedAbsolute(workDir), WORK_VIDEO)
}

function clipInput(c: PlannedClip<VideoClip & GraphClip>, fps: 30 | 60): string[] {
  const { clip } = c
  const length = seconds(c.endMs - clip.startMs)
  const timing = ['-t', length, '-itsoffset', seconds(clip.startMs)]
  const read = clip.still
    ? ['-pattern_type', 'none', '-loop', '1', '-framerate', whole(fps), ...timing]
    : ['-ss', seconds(clip.inMs), ...timing]
  return [
    ...WHITELIST,
    '-f',
    CLIP_DEMUXERS[clip.fileType],
    ...read,
    '-i',
    `file:${checkedAbsolute(clip.path)}`,
  ]
}

export function videoArgs(spec: VideoAdSpec): string[] {
  const encoder = ENCODERS[spec.platform]
  if (!encoder) throw new Error(AD_FAILURES.videoSystem)
  const out = workVideoPath(spec.workDir)
  const clips = spec.clips.map((clip) => ({ ...clip, still: STILLS.has(clip.fileType) }))
  const planned = planClips(clips, spec.background, spec.durationMs)
  const fps = whole(spec.fps)
  const sound = soundArgs(spec.sound ?? { source: 'none' }, planned, spec.durationMs)
  const graph = [filterGraph(planned, spec.size, spec.durationMs, spec.fps), ...sound.graph]
  assertSafeGraph(graph.join(';'))
  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-n',
    ...WHITELIST,
    '-f',
    'image2pipe',
    '-framerate',
    fps,
    '-c:v',
    'png',
    '-i',
    'pipe:0',
    ...planned.flatMap((c) => clipInput(c, spec.fps)),
    ...sound.inputs,
    '-filter_complex',
    graph.join(';'),
    '-map',
    '[out]',
    ...sound.output,
    '-c:v',
    encoder,
    '-b:v',
    '12M',
    '-pix_fmt',
    'yuv420p',
    '-r',
    fps,
    '-movflags',
    '+faststart',
    '-f',
    'mp4',
    `file:${out}`,
  ]
}
