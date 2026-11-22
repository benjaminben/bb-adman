// P7-8, phase-07.md "Clips and the track": a video variant's thumbnail is drawn at its poster
// time (A-183), and every draw of a video variant carries its clips and their assets. A clip
// row may come from someone else's project file: its numbers are clamped and rounded, and a
// clip whose asset is missing or not an allowed picture or video is left out.
import path from 'node:path'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { makeRenderFixture, V1, V2, type RenderFixture } from './render-fixture'
import { MAX_TRACK_MS } from '@/shared/schemas/commands/clip'

const CLIP_FILE = path.resolve('tests/fixtures/video/tiny.mp4')
const PNG_FILE = path.resolve('src/shared/scene/fonts/InterVariable.woff2')

let r: RenderFixture
afterEach(() => r.f.cleanup())

type AssetSeed = { id: string; kind: string; mime: string; file: string; library?: string }

function addAsset(a: AssetSeed): void {
  r.project.db
    .prepare(
      `INSERT INTO asset (id, library, kind, origin, storage, display_name, abs_path, rel_path,
        mime, byte_size, mtime_ms, content_hash, width, height, duration_ms, created_at)
       VALUES (?, ?, ?, 'imported', 'linked', 'x', ?, 'x', ?, 10, 1, 'h', 64, 64, 1000, 'x')`,
    )
    .run(a.id, a.library ?? 'asset', a.kind, a.file, a.mime)
}

function addClip(id: string, variantId: string, assetId: string, times: number[]): void {
  const [startMs, inMs, outMs] = times
  r.project.db
    .prepare(
      `INSERT INTO background_clip (id, variant_id, asset_id, start_ms, in_ms, out_ms, placement)
       VALUES (?, ?, ?, ?, ?, ?, NULL)`,
    )
    .run(id, variantId, assetId, startMs, inMs, outMs)
}

// V1 becomes a 4 s video whose text layer enters with a fade from 500 to 1500 ms.
async function videoFixture() {
  r = await makeRenderFixture()
  const db = r.project.db
  db.prepare("UPDATE variant SET format = 'video', duration_ms = 4000 WHERE id = ?").run(V1)
  const animation = {
    entrance: { preset: 'fade', startMs: 500, durationMs: 1000 },
    exit: { preset: 'none', startMs: 0, durationMs: 0 },
  }
  db.prepare("UPDATE layer SET animation = ? WHERE id = 't1'").run(JSON.stringify(animation))
  addAsset({ id: 'vid1', kind: 'video', mime: 'video/mp4', file: CLIP_FILE })
}

describe('video thumbnails and clips in a draw [P7-8]', () => {
  it('draws a video thumbnail at the poster time with its clips', async () => {
    await videoFixture()
    addClip('k1', V1, 'vid1', [0, 0, 1000])
    await r.query('thumbnail.get', { variantId: V1 })
    await vi.waitFor(() => expect(r.draw).toHaveBeenCalledTimes(1))
    const input = r.drawCall(0)[0]
    expect(input.timeMs).toBe(1500)
    expect(input.clips).toEqual([
      {
        id: 'k1',
        assetId: 'vid1',
        startMs: 0,
        inMs: 0,
        outMs: 1000,
        placement: null,
        soundOn: true,
      },
    ])
    expect(input.assets.vid1).toEqual({ kind: 'video', missing: false, width: 64, height: 64 })
  })

  it('passes the clips sorted by start, then ID, to variant.render at its time', async () => {
    await videoFixture()
    addClip('k2', V1, 'vid1', [2000, 0, 1000])
    addClip('k1', V1, 'vid1', [0, 0, 1000])
    await r.query('variant.render', { variantId: V1, maxDimension: 64, timeMs: 2500 })
    const input = r.drawCall(0)[0]
    expect(input.timeMs).toBe(2500)
    expect(input.clips?.map((c) => c.id)).toEqual(['k1', 'k2'])
  })

  it('clamps stored clip times before the draw', async () => {
    await videoFixture()
    addClip('k1', V1, 'vid1', [-500, -20, MAX_TRACK_MS * 3])
    await r.query('variant.render', { variantId: V1, maxDimension: 64 })
    expect(r.drawCall(0)[0].clips).toEqual([
      expect.objectContaining({ startMs: 0, inMs: 0, outMs: MAX_TRACK_MS }),
    ])
  })

  it.each([
    ['a missing file', { kind: 'video', mime: 'video/mp4', file: '/nowhere/gone.mp4' }],
    ['a WebM video', { kind: 'video', mime: 'video/webm', file: CLIP_FILE }],
    ['a font', { kind: 'font', mime: 'font/woff2', file: PNG_FILE }],
    [
      'a reference picture',
      { kind: 'image', mime: 'image/png', file: CLIP_FILE, library: 'reference' },
    ],
    ['a trim with no length', { kind: 'video', mime: 'video/mp4', file: CLIP_FILE, trim: true }],
  ])('leaves out a clip on %s', async (_name, seed) => {
    await videoFixture()
    addAsset({ id: 'odd1', ...seed })
    addClip('k1', V1, 'odd1', 'trim' in seed ? [0, 500, 500] : [0, 0, 1000])
    await r.query('variant.render', { variantId: V1, maxDimension: 64 })
    const input = r.drawCall(0)[0]
    expect(input.clips).toEqual([])
    expect(input.assets.odd1).toBeUndefined()
  })

  it('gives an image variant no clips and its thumbnail time 0', async () => {
    r = await makeRenderFixture()
    addAsset({ id: 'vid1', kind: 'video', mime: 'video/mp4', file: CLIP_FILE })
    addClip('k1', V2, 'vid1', [0, 0, 1000])
    await r.query('thumbnail.get', { variantId: V2 })
    await vi.waitFor(() => expect(r.draw).toHaveBeenCalledTimes(1))
    const input = r.drawCall(0)[0]
    expect(input.timeMs).toBe(0)
    expect(input.clips).toBeUndefined()
    expect(input.assets.vid1).toBeUndefined()
  })
})
