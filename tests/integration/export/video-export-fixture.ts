// Test helper for P8-16: the export job of setupExport with one ad made a 2 s video, frames
// drawn as real transparent PNGs, the real media tool over a given FFmpeg (the fetched one by
// default), and clip rows written straight into the project file, as a file from someone else
// would hold them. Not a test file itself.
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { vi } from 'vitest'
import { setupExport } from './export-job-fixture'
import { createMediaTool } from '@/main/media/embed-details'
import { binaryUsableNow, ffmpegPath } from '@/main/media/ffmpeg-path'
import type { FfmpegRunner } from '@/main/media/run-ffmpeg'
import { createRenderService } from '@/main/thumbnails/service'
import type { DrawScene } from '@/main/thumbnails/types'
import { adPath } from '@/shared/export/output-paths'
import type { SceneInput } from '@/shared/scene/types'

export const FETCHED_FFMPEG = ffmpegPath({
  packaged: false,
  resourcesPath: '',
  appPath: process.cwd(),
  platform: process.platform,
  arch: process.arch,
})
export const ffmpegFetched = () => binaryUsableNow(FETCHED_FFMPEG)

export const SIZE = { width: 360, height: 640 }
export const DURATION_MS = 2000

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(bytes: Buffer): number {
  let c = 0xffffffff
  for (const b of bytes) c = (crcTable[(c ^ b) & 0xff] as number) ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type: string, body: Buffer): Buffer {
  const head = Buffer.alloc(4)
  head.writeUInt32BE(body.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'latin1'), body])))
  return Buffer.concat([head, Buffer.from(type, 'latin1'), body, crc])
}

// An RGBA PNG of one colour; alpha 0 gives a clear frame.
export function solidPng(size: { width: number; height: number }, rgba: number[]): Uint8Array {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size.width, 0)
  ihdr.writeUInt32BE(size.height, 4)
  ihdr.set([8, 6, 0, 0, 0], 8)
  const row = Buffer.concat([
    Buffer.from([0]),
    Buffer.alloc(size.width * 4).fill(Buffer.from(rgba)),
  ])
  const raw = Buffer.concat(Array.from({ length: size.height }, () => row))
  return new Uint8Array(
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', ihdr),
      chunk('IDAT', zlib.deflateSync(raw)),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  )
}

// The sample count of the first stsz box: the frame count of a file with one video track.
export function frameCountOf(mp4: Buffer): number {
  const at = mp4.indexOf(Buffer.from('stsz', 'latin1'))
  if (at < 0) throw new Error('No stsz box')
  return mp4.readUInt32BE(at + 12)
}

export async function setupVideoExport(opts: { binary?: string } = {}) {
  const t = await setupExport()
  const { fx } = t
  const db = () => fx.core.deps.projects.requireOpen(t.projectId).db
  const first = t.ordered()[0]
  if (!first) throw new Error('No variant')
  const video = first
  t.makeVideo(video.id)
  db()
    .prepare('UPDATE variant SET duration_ms = ?, width = ?, height = ? WHERE id = ?')
    .run(DURATION_MS, SIZE.width, SIZE.height, video.id)

  const frame = solidPng(SIZE, [0, 0, 0, 0])
  const drawn: SceneInput[] = []
  const draws = { cancelAt: 0, failAt: 0, jobId: '' }
  const draw: DrawScene = async (input) => {
    drawn.push(input)
    if (drawn.length === draws.cancelAt) await fx.core.deps.jobs.cancel(t.projectId, draws.jobId)
    if (drawn.length === draws.failAt) throw new Error('The draw failed')
    return { png: frame, overflow: {} }
  }
  fx.core.deps.render = createRenderService({
    deps: () => fx.core.deps,
    bus: () => fx.core.bus,
    emit: () => undefined,
    draw,
  })
  const tool = createMediaTool({
    binary: opts.binary ?? FETCHED_FFMPEG,
    userData: fx.core.deps.userDataDir,
    log: { write: vi.fn() },
  })
  // Every FFmpeg run, its arguments and its end, seen through the one runner.
  const runs: Array<{ args: string[]; result: Promise<'done' | null> }> = []
  const ffmpeg: FfmpegRunner = {
    run(args, folder, options) {
      const result = tool.ffmpeg.run(args, folder, options)
      runs.push({ args, result })
      return result
    },
  }
  fx.core.deps.media = { ...tool, ffmpeg }

  const folder = path.dirname(fx.core.deps.projects.requireOpen(t.projectId).filePath)
  function addAsset(id: string, bytes: Uint8Array | null, over: Record<string, unknown> = {}) {
    const row = {
      kind: 'image',
      mime: 'image/png',
      name: `${id}.png`,
      width: 100,
      height: 100,
      durationMs: null as number | null,
      ...over,
    }
    const file = (over.absPath as string | undefined) ?? path.join(folder, row.name as string)
    if (bytes) fs.writeFileSync(file, bytes)
    db()
      .prepare(
        `INSERT INTO asset (id, library, kind, origin, storage, display_name, abs_path, rel_path,
          mime, byte_size, mtime_ms, content_hash, width, height, duration_ms, created_at)
         VALUES (?, 'asset', ?, 'imported', 'linked', ?, ?, ?, ?, 10, 1, 'h', ?, ?, ?, 'x')`,
      )
      .run(id, row.kind, row.name, file, row.name, row.mime, row.width, row.height, row.durationMs)
  }
  let clipNumber = 0
  function addClip(assetId: string, at: { startMs: number; inMs?: number; outMs: number }) {
    clipNumber++
    db()
      .prepare(
        `INSERT INTO background_clip (id, variant_id, asset_id, start_ms, in_ms, out_ms, placement,
          sound_on) VALUES (?, ?, ?, ?, ?, ?, NULL, 1)`,
      )
      .run(`C${clipNumber}`, video.id, assetId, at.startMs, at.inMs ?? 0, at.outMs)
  }

  const file = adPath({
    campaignId: t.campaignId,
    title: video.title,
    sizeLabel: video.sizeLabel,
    language: video.language,
    variantId: video.id,
    ext: 'mp4',
  })
  const workBase = path.join(fx.core.deps.userDataDir, 'export-work')
  return {
    ...t,
    videoId: video.id,
    file,
    drawn,
    runs,
    addAsset,
    addClip,
    cancelOnDraw: (n: number) => void (draws.cancelAt = n),
    failDrawAt: (n: number) => void (draws.failAt = n),
    workLeft: () => (fs.existsSync(workBase) ? fs.readdirSync(workBase) : []),
    async runVideo() {
      const end = t.run({ variantIds: [video.id] })
      const last = db()
        .prepare("SELECT id FROM job WHERE kind = 'export' ORDER BY id DESC LIMIT 1")
        .get() as { id: string }
      draws.jobId = last.id
      return end
    },
  }
}
