// P8-16 (spec/phases/phase-08.md "Video"): an asset whose stored path is an address or an FFmpeg
// protocol string is never handed to FFmpeg. The ad fails as a missing file, and a listener on
// this machine gets no request.
import fs from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createFfmpegRunner } from '@/main/media/run-ffmpeg'
import { AD_FAILURES } from '@/shared/export/messages'
import { FETCHED_FFMPEG, ffmpegFetched, setupVideoExport } from './video-export-fixture'

type Setup = Awaited<ReturnType<typeof setupVideoExport>>
let s: Setup | undefined
let server: http.Server | undefined
afterEach(async () => {
  s?.fx.cleanup()
  s = undefined
  await new Promise((r) => (server ? server.close(r) : r(undefined)))
  server = undefined
})

describe('FFmpeg reaches no network through a stored path [P8-16]', () => {
  it.each([
    ['an http address', (port: number) => `http://127.0.0.1:${port}/x.mp4`],
    ['a concat string', () => 'concat:a.mp4|b.mp4'],
    ['a tcp address', (port: number) => `tcp://127.0.0.1:${port}`],
  ])('fails the ad as a missing file for %s', async (_name, stored) => {
    let requests = 0
    server = http.createServer((_req, res) => {
      requests++
      res.end()
    })
    server.on('connection', () => requests++)
    await new Promise<void>((r) => server?.listen(0, '127.0.0.1', r))
    const port = (server.address() as AddressInfo).port
    const t = await setupVideoExport()
    s = t
    t.addAsset('V1', null, {
      kind: 'video',
      mime: 'video/mp4',
      name: 'Far clip.mp4',
      width: 64,
      height: 64,
      durationMs: 1000,
      absPath: stored(port),
    })
    t.addClip('V1', { startMs: 0, outMs: 1000 })
    await t.runVideo()
    expect(t.reportOutcomes()[0]?.failure).toBe('A file this ad uses is missing: Far clip.mp4.')
    expect(t.runs).toEqual([])
    expect(requests).toBe(0)
    expect(t.workLeft()).toEqual([])
  })
})

// P8-17, from the review of video export: a real hostile file. A MOV made here from the tiny
// test clip, whose data reference (`dref`) is not self-contained: a `url ` entry pointing at a
// listener on this machine or at a file elsewhere on disk, or an `alis` entry (the kind FFmpeg
// does follow when -enable_drefs and -use_absolute_path are set) with that file's absolute path.
// The project's copy has its sample bytes zeroed; the file elsewhere is the same MOV with its
// samples intact. So the ad can only export if FFmpeg read the file elsewhere: the listener gets
// no request and the ad is not made. Nothing but the test's own listener is contacted.
const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'dinf', 'stbl'])

function box(type: string, body: Buffer): Buffer {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(8 + body.length, 0)
  head.write(type, 4, 'latin1')
  return Buffer.concat([head, body])
}

// An alias record: 150 bytes of fixed fields, then the absolute path (extra type 2), then end.
function alias(file: string): Buffer {
  const fixed = Buffer.alloc(150)
  fixed.writeUInt16BE(2, 6)
  const name = Buffer.from(file, 'utf8')
  const tag = Buffer.alloc(4)
  tag.writeUInt16BE(2, 0)
  tag.writeUInt16BE(name.length, 2)
  const pad = Buffer.alloc(name.length & 1)
  const end = Buffer.from([255, 255, 0, 0])
  return box('alis', Buffer.concat([Buffer.alloc(4), fixed, tag, name, pad, end]))
}

const urlEntry = (location: string) =>
  box('url ', Buffer.concat([Buffer.alloc(4), Buffer.from(`${location}\0`, 'utf8')]))

// tiny.mp4 with its dref swapped for one external entry. Its moov comes before mdat, so the
// boxes that hold the dref grow and the chunk offsets move by the same amount.
function movReferring(entry: Buffer, zeroSamples: boolean): Buffer {
  const file = fs.readFileSync('tests/fixtures/video/tiny.mp4')
  const dref = box('dref', Buffer.concat([Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]), entry]))
  const parents: number[] = []
  const found: { at: number; size: number }[] = []
  const walk = (start: number, end: number, path: number[]) => {
    for (let at = start; at + 8 <= end; at += file.readUInt32BE(at)) {
      const type = file.toString('latin1', at + 4, at + 8)
      if (type === 'dref') {
        found.push({ at, size: file.readUInt32BE(at) })
        parents.push(...path)
      } else if (CONTAINERS.has(type)) walk(at + 8, at + file.readUInt32BE(at), [...path, at])
    }
  }
  walk(0, file.length, [])
  const [old] = found
  if (!old) throw new Error('The test clip has no dref.')
  const delta = dref.length - old.size
  const out = Buffer.concat([file.subarray(0, old.at), dref, file.subarray(old.at + old.size)])
  for (const at of parents) out.writeUInt32BE(out.readUInt32BE(at) + delta, at)
  const stco = out.indexOf('stco', old.at + dref.length, 'latin1') - 4
  const entries = out.readUInt32BE(stco + 12)
  for (let k = 0; k < entries; k++) {
    const at = stco + 16 + k * 4
    out.writeUInt32BE(out.readUInt32BE(at) + delta, at)
  }
  const mdat = out.indexOf('mdat', stco, 'latin1') - 4
  if (zeroSamples) out.fill(0, mdat + 8, mdat + out.readUInt32BE(mdat))
  return out
}

type Entry = (port: number, file: string) => Buffer

describe('FFmpeg follows no data reference inside a MOV [P8-17]', () => {
  it.for<[string, Entry]>([
    ['a url entry to a loopback listener', (port) => urlEntry(`http://127.0.0.1:${port}/x.mov`)],
    ['a url entry to a file elsewhere', (_port, file) => urlEntry(`file://${file}`)],
    ['an alias to a file elsewhere', (_port, file) => alias(file)],
  ])('makes no request and reads nothing from %s', async ([, entry], ctx) => {
    if (!ffmpegFetched()) ctx.skip('FFmpeg is not fetched.')
    const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-dref-'))
    try {
      const far = path.join(elsewhere, 'far.mov')
      let requests = 0
      server = http.createServer((_req, res) => {
        requests++
        res.end()
      })
      server.on('connection', () => requests++)
      await new Promise<void>((r) => server?.listen(0, '127.0.0.1', r))
      const port = (server.address() as AddressInfo).port
      fs.writeFileSync(far, movReferring(entry(port, far), false))
      const t = await setupVideoExport()
      s = t
      t.addAsset('V1', movReferring(entry(port, far), true), {
        kind: 'video',
        mime: 'video/quicktime',
        name: 'Hostile.mov',
        width: 64,
        height: 64,
        durationMs: 1000,
      })
      t.addClip('V1', { startMs: 0, outMs: 1000 })
      const end = await t.runVideo()
      expect(end.status).toBe('succeeded')
      // The clip was handed to FFmpeg: the case is not refused before the run.
      expect(t.runs.length).toBeGreaterThan(0)
      expect(requests).toBe(0)
      // Only the file elsewhere holds usable samples: an ad made would have read it.
      expect(t.reportOutcomes()[0]?.failure).toBe(AD_FAILURES.videoNotMade)
      expect(t.files()).toEqual([])
      expect(t.workLeft()).toEqual([])
    } finally {
      fs.rmSync(elsewhere, { recursive: true, force: true })
    }
  })
})

// Review fix, the control for the block above: the hand-built file really is hostile. The same
// project copy (samples zeroed, an alias to the file elsewhere), run through the app's one
// runner with the two data-reference flags added here by the test alone, reads the file
// elsewhere and gives a frame. Without them, nothing is made. The flags never appear under src/.
describe('the hostile MOV is hostile when data references are switched on [control]', () => {
  it('reads the file elsewhere only with the flags the app never passes', async (ctx) => {
    if (!ffmpegFetched()) ctx.skip('FFmpeg is not fetched.')
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-dref-control-'))
    try {
      const far = path.join(folder, 'far.mov')
      const copy = path.join(folder, 'copy.mov')
      fs.writeFileSync(far, movReferring(alias(far), false))
      fs.writeFileSync(copy, movReferring(alias(far), true))
      const runner = createFfmpegRunner({ binary: FETCHED_FFMPEG })
      const frameOf = async (flags: string[], name: string) => {
        const out = path.join(folder, name)
        const input = ['-protocol_whitelist', 'file,pipe', '-f', 'mov', ...flags]
        const output = ['-map', '0:v:0', '-frames:v', '1', '-c:v', 'png', '-f', 'image2pipe']
        const args = ['-nostdin', '-y', ...input, '-i', `file:${copy}`, ...output, `file:${out}`]
        const result = await runner.run(args, folder)
        return { result, made: fs.existsSync(out) && fs.statSync(out).size > 0 }
      }
      expect(await frameOf([], 'plain.png')).toEqual({ result: null, made: false })
      const followed = await frameOf(['-enable_drefs', '1', '-use_absolute_path', '1'], 'far.png')
      expect(followed).toEqual({ result: 'done', made: true })
    } finally {
      fs.rmSync(folder, { recursive: true, force: true })
    }
  })
})
