// P8-16: a video ad exports to MP4 through the fetched FFmpeg (spec/phases/phase-08.md "Video",
// "Export run"; spec/export-and-checks.md "Video variant") [REQ: FR-131]. A real core and job
// runner; the draw gives real transparent PNG frames; the report port and the picture encoder
// are stand-ins. Each case that needs FFmpeg skips with "FFmpeg is not fetched." without it.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, type TestContext } from 'vitest'
import { writeStandIn } from '../media/stand-in'
import {
  FETCHED_FFMPEG,
  ffmpegFetched,
  frameCountOf,
  setupVideoExport,
  solidPng,
} from './video-export-fixture'
import { CLIP_REFUSED } from '@/main/export/video/clip-files'
import { AD_FAILURES } from '@/shared/export/messages'

type Setup = Awaited<ReturnType<typeof setupVideoExport>>
let s: Setup | undefined
afterEach(() => {
  s?.fx.cleanup()
  s = undefined
})

function needFfmpeg(ctx: TestContext): void {
  if (!ffmpegFetched()) ctx.skip('FFmpeg is not fetched.')
}

async function setup(opts: { binary?: string } = {}): Promise<Setup> {
  s = await setupVideoExport(opts)
  return s
}

// The colour at the middle of the frame at `seconds`, read back with the fetched FFmpeg.
function colourAt(file: string, seconds: number): number[] {
  const args = ['-v', 'error', '-ss', String(seconds), '-i', file, '-frames:v', '1']
  const out = spawnSync(
    FETCHED_FFMPEG,
    [...args, '-vf', 'crop=2:2', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'],
    { maxBuffer: 1 << 20 },
  )
  return [...out.stdout.subarray(0, 3)]
}
const near = (a: number[], b: number[]) => a.every((v, i) => Math.abs(v - (b[i] as number)) < 40)

function noPartials(t: Setup): void {
  expect(t.allNames().filter((n) => n.endsWith('.partial'))).toEqual([])
}

describe.skipIf(process.platform !== 'darwin' && process.platform !== 'win32')(
  'the video export [P8-16]',
  () => {
    it('exports a 2 s ad with one still clip as one MP4 of 60 frames at the layout name', async (ctx) => {
      needFfmpeg(ctx)
      const t = await setup()
      t.addAsset('P1', solidPng({ width: 100, height: 100 }, [255, 0, 0, 255]))
      t.addClip('P1', { startMs: 1000, outMs: 1000 })
      const end = await t.runVideo()

      expect(end.status).toBe('succeeded')
      const [outcome] = t.reportOutcomes()
      expect(outcome).toMatchObject({ variantId: t.videoId, file: t.file, failure: null })
      expect(t.files()).toEqual([t.file])
      const mp4 = fs.readFileSync(path.join(t.root, t.file))
      expect(frameCountOf(mp4)).toBe(60)
      // The clip shows from 1 s, by its input options; before it the base is black.
      expect(near(colourAt(path.join(t.root, t.file), 0.5), [0, 0, 0])).toBe(true)
      expect(near(colourAt(path.join(t.root, t.file), 1.5), [255, 0, 0])).toBe(true)
      // Every frame drawn over a clear page at the time its number gives.
      expect(t.drawn.map((d) => d.timeMs)).toEqual(
        Array.from({ length: 60 }, (_, i) => (i * 1000) / 30),
      )
      expect(t.drawn.every((d) => d.mode === 'overlay-only')).toBe(true)
      noPartials(t)
      expect(t.workLeft()).toEqual([])
    })

    it('gives the report a still from the middle of the video, made a JPEG', async (ctx) => {
      needFfmpeg(ctx)
      const t = await setup()
      const end = await t.runVideo()
      expect(end.status).toBe('succeeded')
      const [still, side] = t.shrink.mock.calls[0] ?? []
      expect([...(still ?? new Uint8Array()).subarray(0, 4)]).toEqual([137, 80, 78, 71])
      expect(side).toBe(240)
      const picture = t.reportOutcomes()[0]?.picture
      expect([...(picture ?? new Uint8Array()).subarray(0, 2)]).toEqual([0xff, 0xd8])
    })

    it('exports a video clip cut to its trim', async (ctx) => {
      needFfmpeg(ctx)
      const t = await setup()
      const clip = fs.readFileSync('tests/fixtures/video/tiny.mp4')
      t.addAsset('V1', clip, {
        kind: 'video',
        mime: 'video/mp4',
        name: 'V1.mp4',
        width: 64,
        height: 64,
        durationMs: 1000,
      })
      t.addClip('V1', { startMs: 500, inMs: 200, outMs: 1000 })
      const end = await t.runVideo()
      expect(end.status).toBe('succeeded')
      expect(t.runs[0]?.args).toContain('mov')
      expect(frameCountOf(fs.readFileSync(path.join(t.root, t.file)))).toBe(60)
    })

    it("reads a video's length from its file, not its row: a trim past the file's end fails", async () => {
      const t = await setup()
      const clip = fs.readFileSync('tests/fixtures/video/tiny.mp4')
      const row = { kind: 'video', mime: 'video/mp4', name: 'V1.mp4', width: 64, height: 64 }
      t.addAsset('V1', clip, { ...row, durationMs: 5000 })
      t.addClip('V1', { startMs: 0, outMs: 3000 })
      await t.runVideo()
      expect(t.reportOutcomes()[0]?.failure).toBe(CLIP_REFUSED)
      expect(t.runs).toEqual([])
    })

    it("measures a still itself rather than trusting the row's size", async (ctx) => {
      needFfmpeg(ctx)
      const t = await setup()
      t.addAsset('P1', solidPng({ width: 10, height: 10 }, [0, 255, 0, 255]), {
        width: 100,
        height: 50,
      })
      t.addClip('P1', { startMs: 0, outMs: 2000 })
      const end = await t.runVideo()
      expect(end.status).toBe('succeeded')
      // The file is square, so it is scaled square; the row's 100 x 50 would not be.
      const scale = /scale=w=(\d+):h=(\d+)/.exec(t.runs[0]?.args.join(' ') ?? '')
      expect(scale?.[1]).toBeDefined()
      expect(scale?.[1]).toBe(scale?.[2])
    })

    it('exports a clip that has sound as a silent MP4 (sound is not built yet)', async (ctx) => {
      needFfmpeg(ctx)
      const t = await setup()
      const clip = fs.readFileSync('tests/fixtures/video/tiny-sound.mp4')
      t.addAsset('V1', clip, { kind: 'video', mime: 'video/mp4', name: 'V1.mp4', durationMs: 1000 })
      t.addClip('V1', { startMs: 0, outMs: 1000 })
      const end = await t.runVideo()
      expect(end.status).toBe('succeeded')
      const mp4 = fs.readFileSync(path.join(t.root, t.file))
      expect(mp4.includes(Buffer.from('soun', 'latin1'))).toBe(false)
      expect(frameCountOf(fs.readFileSync(path.join(t.root, t.file)))).toBe(60)
    })

    it('gives FFmpeg no output folder and no path of the user, only the work folder and pipe:0', async (ctx) => {
      needFfmpeg(ctx)
      const t = await setup()
      t.addAsset('P1', solidPng({ width: 10, height: 10 }, [0, 0, 255, 255]))
      t.addClip('P1', { startMs: 0, outMs: 2000 })
      await t.runVideo()
      const work = fs.realpathSync(path.join(t.fx.core.deps.userDataDir, 'export-work'))
      expect(t.runs.length).toBe(2)
      const projectFile = t.fx.core.deps.projects.requireOpen(t.projectId).filePath
      const projectFolder = fs.realpathSync(path.dirname(projectFile))
      for (const { args } of t.runs) {
        expect(args.join(' ')).not.toContain(t.root)
        expect(args.join(' ')).not.toContain(projectFolder)
        const inputs = args.flatMap((a, i) => (args[i - 1] === '-i' ? [a] : []))
        for (const input of inputs) {
          if (input === 'pipe:0') continue
          expect(input.startsWith(`file:${work}${path.sep}`)).toBe(true)
        }
        expect(args).not.toContain('-enable_drefs')
      }
      const [encode] = t.runs
      expect(encode?.args.at(-1)?.startsWith(`file:${work}${path.sep}`)).toBe(true)
      expect(encode?.args).toContain('-an')
    })

    it('fails the ad with its sentence when FFmpeg ends with an error, and leaves nothing', async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-video-fail-'))
      try {
        const t = await setup({ binary: writeStandIn(dir, 'process.exit(3)') })
        const end = await t.runVideo()
        expect(end.status).toBe('succeeded')
        expect(t.reportOutcomes()[0]).toMatchObject({
          file: null,
          failure: AD_FAILURES.videoNotMade,
        })
        expect(t.files()).toEqual([])
        noPartials(t)
        expect(t.workLeft()).toEqual([])
      } finally {
        fs.rmSync(dir, { recursive: true, force: true })
      }
    })

    it('fails the ad when a frame cannot be drawn, and leaves nothing', async (ctx) => {
      needFfmpeg(ctx)
      const t = await setup()
      t.failDrawAt(5)
      await t.runVideo()
      expect(t.reportOutcomes()[0]?.failure).toBe(AD_FAILURES.videoNotMade)
      expect(t.files()).toEqual([])
      expect(t.workLeft()).toEqual([])
    })

    it('stops FFmpeg and removes the work folder when the export is cancelled mid-way', async (ctx) => {
      needFfmpeg(ctx)
      const t = await setup()
      t.cancelOnDraw(10)
      const end = await t.runVideo()
      expect(end.status).toBe('cancelled')
      expect(t.drawn.length).toBeLessThan(15)
      expect(await t.runs[0]?.result).toBeNull()
      expect(t.runs.length).toBe(1)
      expect(t.files()).toEqual([])
      noPartials(t)
      expect(t.workLeft()).toEqual([])
      expect(t.report).not.toHaveBeenCalled()
    })

    it('fails the ad as a missing file when a clip file is not there', async () => {
      const t = await setup()
      t.addAsset('P1', null, { name: 'Gone picture.png' })
      t.addClip('P1', { startMs: 0, outMs: 2000 })
      await t.runVideo()
      expect(t.reportOutcomes()[0]?.failure).toBe(
        'A file this ad uses is missing: Gone picture.png.',
      )
      expect(t.runs).toEqual([])
    })

    it.each([
      ['shorter than 100 ms', [{ startMs: 0, outMs: 50 }]],
      ['starting before 0', [{ startMs: -5, outMs: 1000 }]],
      [
        'overlapping another',
        [
          { startMs: 0, outMs: 1500 },
          { startMs: 1000, outMs: 900 },
        ],
      ],
    ])('fails the ad, running nothing, for a clip row %s', async (_name, clips) => {
      const t = await setup()
      t.addAsset('P1', solidPng({ width: 10, height: 10 }, [0, 0, 255, 255]))
      for (const clip of clips) t.addClip('P1', clip)
      await t.runVideo()
      expect(t.reportOutcomes()[0]).toMatchObject({ file: null, failure: CLIP_REFUSED })
      expect(t.runs).toEqual([])
      expect(t.workLeft()).toEqual([])
    })

    it('fails the ad for a clip whose file is not of the type its name says', async () => {
      const t = await setup()
      t.addAsset('P1', new TextEncoder().encode('#EXTM3U\nhttp://127.0.0.1:9/x.ts\n'))
      t.addClip('P1', { startMs: 0, outMs: 2000 })
      await t.runVideo()
      expect(t.reportOutcomes()[0]?.failure).toBe(CLIP_REFUSED)
      expect(t.runs).toEqual([])
    })
  },
)

describe('the video export on another system [P8-16]', () => {
  it('fails the ad with its sentence and runs nothing', async () => {
    const real = process.platform
    Object.defineProperty(process, 'platform', { value: 'linux' })
    try {
      const t = await setup()
      await t.runVideo()
      expect(t.reportOutcomes()[0]?.failure).toBe(AD_FAILURES.videoSystem)
      expect(t.runs).toEqual([])
    } finally {
      Object.defineProperty(process, 'platform', { value: real })
    }
  })
})
