// The sound of one video ad, as FFmpeg arguments (spec/export-and-checks.md "Sound in export";
// CQ-32 as ruled for P8-17). The ad has one source, as the editor plays it:
// - 'none': silent (-an).
// - 'clips': each clip's own sound where it is on and the file holds sound, placed at the clip's
//   time. The clip's copy is read a second time for its sound, from its in point for its length
//   (-ss, -t), then delayed to its start (adelay); two or more are mixed (amix). No clip with
//   sound: silent.
// - 'file': the added audio file from the ad's start, cut at its end (-t). Nothing is mixed.
// Security (spec/phases/phase-07.md "How FFmpeg is run"): every input is `-protocol_whitelist
// file,pipe`, the demuxer the sniffed type pins (one per type, never a probe), then `file:` and
// an absolute path of a copy in the work folder. The graph holds only numbers from the formatter
// and fixed names; the caller checks the whole graph with assertSafeGraph.
import path from 'node:path'
import type { VideoClip } from './encoder-args'
import { seconds, whole, type GraphClip, type PlannedClip } from './filter-graph'

export type SoundFileType = 'mp3' | 'wav' | 'm4a' | 'aac'

export type AdSound =
  | { source: 'none' }
  | { source: 'clips' }
  | { source: 'file'; path: string; fileType: SoundFileType }

export type SoundArgs = { inputs: string[]; graph: string[]; output: string[] }

const DEMUXERS: Record<SoundFileType, string> = { mp3: 'mp3', wav: 'wav', m4a: 'mov', aac: 'aac' }
const CLIP_DEMUXER = 'mov'
const ENCODE = ['-c:a', 'aac', '-b:a', '192k']
const SILENT: SoundArgs = { inputs: [], graph: [], output: ['-an'] }

function fileInput(demuxer: string, read: string[], file: string): string[] {
  if (!path.isAbsolute(file)) throw new Error('FFmpeg is given absolute paths only.')
  return ['-protocol_whitelist', 'file,pipe', '-f', demuxer, ...read, '-i', `file:${file}`]
}

type Planned = PlannedClip<VideoClip & GraphClip>

function clipsSound(planned: Planned[], first: number): SoundArgs {
  const heard = planned.filter((c) => c.clip.sound === true && !c.clip.still)
  if (heard.length === 0) return SILENT
  const single = heard.length === 1
  const inputs = heard.flatMap(({ clip, startMs, endMs }) => {
    const read = ['-ss', seconds(clip.inMs), '-t', seconds(endMs - startMs)]
    return fileInput(CLIP_DEMUXER, read, clip.path)
  })
  const graph = heard.map(
    (c, k) =>
      `[${first + k}:a]adelay=delays=${whole(c.startMs)}:all=1[${single ? 'aout' : `s${k}`}]`,
  )
  if (!single) {
    const labels = heard.map((_, k) => `[s${k}]`).join('')
    graph.push(`${labels}amix=inputs=${whole(heard.length)}:duration=longest:normalize=0[aout]`)
  }
  return { inputs, graph, output: ['-map', '[aout]', ...ENCODE] }
}

// The clips' inputs are 1 to planned.length (the frame stream is 0); sound inputs follow them.
export function soundArgs(sound: AdSound, planned: Planned[], durationMs: number): SoundArgs {
  const first = planned.length + 1
  if (sound.source === 'clips') return clipsSound(planned, first)
  if (sound.source !== 'file') return SILENT
  const read = ['-t', seconds(durationMs)]
  return {
    inputs: fileInput(DEMUXERS[sound.fileType], read, sound.path),
    graph: [],
    output: ['-map', `${whole(first)}:a:0`, ...ENCODE],
  }
}
