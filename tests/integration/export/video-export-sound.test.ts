// P8-17: the video export reuses still overlay frames and carries the ad's one sound source,
// through the real job and the fetched FFmpeg. Skips with "FFmpeg is not fetched." without it.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, type TestContext } from 'vitest'
import { ffmpegFetched, frameCountOf, setupVideoExport } from './video-export-fixture'
import { toneWav } from './tone-wav'

type Setup = Awaited<ReturnType<typeof setupVideoExport>>
let s: Setup | undefined
afterEach(() => {
  s?.fx.cleanup()
  s = undefined
})

async function setup(ctx: TestContext) {
  if (!ffmpegFetched()) ctx.skip('FFmpeg is not fetched.')
  s = await setupVideoExport()
  const t = s
  const db = t.fx.core.deps.projects.requireOpen(t.projectId).db
  const run = (sql: string, ...values: unknown[]) => db.prepare(sql).run(...values)
  // Still layers: no animation, the whole ad long.
  const none = { preset: 'none', startMs: 0, durationMs: 0 }
  run(
    'UPDATE layer SET animation = ? WHERE variant_id = ?',
    JSON.stringify({ entrance: none, exit: none }),
    t.videoId,
  )
  const soundClip = () => {
    const bytes = fs.readFileSync('tests/fixtures/video/tiny-sound.mp4')
    t.addAsset('V1', bytes, { kind: 'video', mime: 'video/mp4', name: 'V1.mp4', durationMs: 1000 })
    t.addClip('V1', { startMs: 0, outMs: 1000 })
  }
  const out = () => fs.readFileSync(path.join(t.root, t.file))
  const hasSound = () => out().includes(Buffer.from('soun', 'latin1'))
  return { t, run, soundClip, out, hasSound }
}

describe.skipIf(process.platform !== 'darwin' && process.platform !== 'win32')(
  'the video export after Phase 7 [P8-17]',
  () => {
    it('draws a still overlay once and sends it again for every frame', async (ctx) => {
      const { t, out } = await setup(ctx)
      const end = await t.runVideo()
      expect(end.status).toBe('succeeded')
      expect(t.drawn.map((d) => d.timeMs)).toEqual([0])
      expect(frameCountOf(out())).toBe(60)
    })

    it("carries the clips' own sound by default", async (ctx) => {
      const { t, soundClip, hasSound } = await setup(ctx)
      soundClip()
      await t.runVideo()
      expect(t.reportOutcomes()[0]?.failure).toBeNull()
      expect(hasSound()).toBe(true)
    })

    it('is silent with the source none, even over a clip with sound', async (ctx) => {
      const { t, run, soundClip, hasSound } = await setup(ctx)
      soundClip()
      run("UPDATE variant SET sound = 'none' WHERE id = ?", t.videoId)
      await t.runVideo()
      expect(t.reportOutcomes()[0]?.failure).toBeNull()
      expect(hasSound()).toBe(false)
      expect(t.runs[0]?.args).toContain('-an')
    })

    it('carries an added WAV, read from its copy in the work folder', async (ctx) => {
      const { t, run, hasSound } = await setup(ctx)
      t.addAsset('S1', toneWav(3000), { kind: 'audio', mime: 'audio/wav', name: 'S1.wav' })
      run("UPDATE variant SET sound = 'file', sound_asset_id = 'S1' WHERE id = ?", t.videoId)
      await t.runVideo()
      expect(t.reportOutcomes()[0]?.failure).toBeNull()
      expect(hasSound()).toBe(true)
      const args = t.runs[0]?.args ?? []
      const work = fs.realpathSync(path.join(t.fx.core.deps.userDataDir, 'export-work'))
      const sound = args.find((a) => a.endsWith(`${path.sep}sound.wav`))
      expect(sound?.startsWith(`file:${work}${path.sep}`)).toBe(true)
      expect(args[args.indexOf(sound as string) - 4]).toBe('wav')
      expect(t.workLeft()).toEqual([])
    })

    it('fails the ad, naming it, when the added file is missing', async (ctx) => {
      const { t, run } = await setup(ctx)
      t.addAsset('S1', null, { kind: 'audio', mime: 'audio/wav', name: 'Theme.wav' })
      run("UPDATE variant SET sound = 'file', sound_asset_id = 'S1' WHERE id = ?", t.videoId)
      await t.runVideo()
      expect(t.reportOutcomes()[0]?.failure).toBe('A file this ad uses is missing: Theme.wav.')
      expect(t.runs).toEqual([])
      expect(t.workLeft()).toEqual([])
    })
  },
)
