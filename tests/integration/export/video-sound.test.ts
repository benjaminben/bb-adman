// P8-17: the sound arguments run in the fetched FFmpeg (the build's mov, wav demuxers, adelay,
// amix and the aac encoder). The argument list of videoArgs, through the app's one runner, over
// copies in a work folder; frames are clear PNGs. Skips with "FFmpeg is not fetched." without it.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { videoFileFacts } from '@/main/assets/video-file-facts'
import { videoArgs, type VideoClip } from '@/main/export/video/encoder-args'
import { pipeFrames } from '@/main/export/video/frame-pipe'
import type { AdSound } from '@/main/export/video/sound-args'
import { createFfmpegRunner } from '@/main/media/run-ffmpeg'
import { FETCHED_FFMPEG, ffmpegFetched, frameCountOf, solidPng } from './video-export-fixture'
import { toneWav } from './tone-wav'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-video-sound-'))
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }))

const SIZE = { width: 360, height: 640 }
const FRAME = solidPng(SIZE, [0, 0, 0, 0])

async function exportWith(sound: AdSound | 'clips-two' | 'clips-one', work: string) {
  const clipFile = path.join(work, 'clip-0.mp4')
  fs.copyFileSync('tests/fixtures/video/tiny-sound.mp4', clipFile)
  const clip = (startMs: number): VideoClip => ({
    path: clipFile,
    fileType: 'mp4',
    source: { width: 64, height: 64 },
    startMs,
    inMs: 0,
    outMs: 500,
    placement: null,
    sound: true,
  })
  const clips = sound === 'clips-two' ? [clip(0), clip(1000)] : [clip(500)]
  const args = videoArgs({
    platform: process.platform,
    size: SIZE,
    durationMs: 2000,
    fps: 30,
    background: { x: 0, y: 0, ...SIZE, rotation: 0, crop: null },
    clips,
    workDir: work,
    sound: typeof sound === 'string' ? { source: 'clips' } : sound,
  })
  const signal = new AbortController().signal
  const result = await createFfmpegRunner({ binary: FETCHED_FFMPEG }).run(args, work, {
    feed: (sink) => pipeFrames({ count: 60, draw: async () => FRAME, sink, signal }),
  })
  expect(result).toBe('done')
  const out = path.join(work, 'ad.mp4')
  const handle = await fs.promises.open(out, 'r')
  try {
    return { frames: frameCountOf(fs.readFileSync(out)), facts: await videoFileFacts(handle) }
  } finally {
    await handle.close()
  }
}

describe.skipIf(process.platform !== 'darwin' && process.platform !== 'win32')(
  'video sound through FFmpeg [P8-17]',
  () => {
    it.for<[string, AdSound | 'clips-two' | 'clips-one', boolean]>([
      ['none: silent', { source: 'none' }, false],
      ["one clip's sound, placed at its time", 'clips-one', true],
      ["two clips' sound, mixed", 'clips-two', true],
      ['an added WAV, cut at the ad end', { source: 'file', path: '', fileType: 'wav' }, true],
    ])('%s', async ([, given, heard], ctx) => {
      if (!ffmpegFetched()) ctx.skip('FFmpeg is not fetched.')
      const work = fs.mkdtempSync(path.join(dir, 'work-'))
      let sound = given
      if (typeof given !== 'string' && given.source === 'file') {
        const wav = path.join(work, 'sound.wav')
        fs.writeFileSync(wav, toneWav(3000))
        sound = { ...given, path: wav }
      }
      const { frames, facts } = await exportWith(sound, work)
      expect(frames).toBe(60)
      expect(facts?.hasSound).toBe(heard)
      // The 3 s tone is cut at the ad's 2 s end; no track runs past it.
      expect(facts?.durationMs).toBeLessThan(2100)
    })
  },
)
