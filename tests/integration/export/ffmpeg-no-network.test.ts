// P8-16 (spec/phases/phase-08.md "Video"): an asset whose stored path is an address or an FFmpeg
// protocol string is never handed to FFmpeg. The ad fails as a missing file, and a listener on
// this machine gets no request.
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { setupVideoExport } from './video-export-fixture'

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
