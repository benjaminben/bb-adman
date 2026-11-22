// Review fix: a clip's own sound is read with the same pinned demuxer as its picture, from the
// one table in clip-demuxers.ts, never a fixed 'mov'.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ClipFileType, VideoClip } from '@/main/export/video/encoder-args'
import { CLIP_DEMUXERS } from '@/main/export/video/clip-demuxers'
import { planClips } from '@/main/export/video/filter-graph'
import { soundArgs } from '@/main/export/video/sound-args'

const background = { x: 0, y: 0, width: 1080, height: 1920, rotation: 0, crop: null }

function soundInputs(fileType: ClipFileType): string[] {
  const clip: VideoClip = {
    path: path.resolve(`/work/clip-0.${fileType}`),
    fileType,
    source: { width: 1920, height: 1080 },
    startMs: 0,
    inMs: 0,
    outMs: 1000,
    placement: null,
    sound: true,
  }
  const planned = planClips([{ ...clip, still: false }], background, 4000)
  return soundArgs({ source: 'clips' }, planned, 4000).inputs
}

describe('a clip sound input uses the clip demuxer table', () => {
  it.each([
    ['mp4', 'mov'],
    ['mov', 'mov'],
    ['webm', 'matroska'],
  ] as const)('a %s clip sound is read with -f %s', (type, demuxer) => {
    const inputs = soundInputs(type)
    expect(inputs[inputs.indexOf('-f') + 1]).toBe(demuxer)
    expect(CLIP_DEMUXERS[type]).toBe(demuxer)
  })
})
