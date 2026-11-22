// P8-16: the runner's frame input (pipe:0), its output (pipe:1), a stop and a per-run time
// limit (spec/phases/phase-08.md "Video"). Everything else of the runner keeps its tests in
// run-ffmpeg.test.ts.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Writable } from 'node:stream'
import { afterAll, describe, expect, it } from 'vitest'
import { createFfmpegRunner } from '@/main/media/run-ffmpeg'
import { writeStandIn } from './stand-in'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-runffmpeg-input-'))
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }))

const cwd = () => fs.mkdtempSync(path.join(dir, 'cwd-'))
const CHUNK = 256 * 1024

// Writes `count` chunks, each only once the one before was taken when the pipe was full.
async function writeChunks(stdin: Writable, count: number, seen: { full: number }) {
  for (let i = 0; i < count; i++) {
    const chunk = Buffer.alloc(CHUNK, i % 256)
    if (!stdin.write(chunk)) {
      seen.full++
      await new Promise<void>((resolve, reject) => {
        const drained = () => {
          stdin.off('error', reject)
          resolve()
        }
        stdin.once('drain', drained)
        stdin.once('error', reject)
      })
    }
  }
  stdin.end()
}

// Reads its input slowly and writes how many bytes it got, and their sum, once it ends.
const SLOW_READER = `const fs = require('fs')
let bytes = 0
let sum = 0
process.stdin.on('data', (d) => {
  bytes += d.length
  for (const b of d) sum = (sum + b) % 1000003
  process.stdin.pause()
  setTimeout(() => process.stdin.resume(), 2)
})
process.stdin.on('end', () => fs.writeFileSync('got.txt', bytes + ' ' + sum))`

const FOREVER = 'process.stdin.resume(); setTimeout(() => {}, 30000)'

describe.skipIf(process.platform === 'win32')('runFfmpeg with a frame input (P8-16)', () => {
  it('feeds standard input with back-pressure respected and every byte in order', async () => {
    const binary = writeStandIn(dir, SLOW_READER)
    const folder = cwd()
    const seen = { full: 0 }
    const count = 40
    const result = await createFfmpegRunner({ binary }).run([], folder, {
      feed: ({ stdin }) => writeChunks(stdin, count, seen),
    })
    expect(result).toBe('done')
    let sum = 0
    for (let i = 0; i < count; i++) sum = (sum + (i % 256) * CHUNK) % 1000003
    expect(fs.readFileSync(path.join(folder, 'got.txt'), 'utf8')).toBe(`${count * CHUNK} ${sum}`)
    // The pipe filled at least once, so the feed waited for it to drain.
    expect(seen.full).toBeGreaterThan(0)
  })

  it('kills the program and gives null when the frame source fails', async () => {
    const binary = writeStandIn(dir, FOREVER)
    const started = Date.now()
    const result = await createFfmpegRunner({ binary }).run([], cwd(), {
      feed: async ({ stdin }) => {
        stdin.write(Buffer.alloc(10))
        throw new Error('The draw failed')
      },
    })
    expect(result).toBeNull()
    expect(Date.now() - started).toBeLessThan(10_000)
  })

  it('hands the feed a kill that stops the program', async () => {
    const binary = writeStandIn(dir, FOREVER)
    const result = await createFfmpegRunner({ binary }).run([], cwd(), {
      feed: async ({ kill }) => {
        kill()
        await new Promise((r) => setTimeout(r, 50))
      },
    })
    expect(result).toBeNull()
  })

  it('kills the program when the job is cancelled mid-way', async () => {
    const binary = writeStandIn(dir, FOREVER)
    const stop = new AbortController()
    setTimeout(() => stop.abort(), 100)
    const started = Date.now()
    const result = await createFfmpegRunner({ binary }).run([], cwd(), { signal: stop.signal })
    expect(result).toBeNull()
    expect(Date.now() - started).toBeLessThan(10_000)
  })

  it('does not start the program when the job was already cancelled', async () => {
    const binary = writeStandIn(dir, "require('fs').writeFileSync('ran.txt', 'x')")
    const folder = cwd()
    const stop = new AbortController()
    stop.abort()
    const result = await createFfmpegRunner({ binary }).run([], folder, { signal: stop.signal })
    expect(result).toBeNull()
    expect(fs.existsSync(path.join(folder, 'ran.txt'))).toBe(false)
  })

  it('gives null, and no unhandled error, when the program ends while frames are still sent', async () => {
    const binary = writeStandIn(dir, 'process.exit(2)')
    const seen = { full: 0 }
    let feedError: unknown = null
    const result = await createFfmpegRunner({ binary }).run([], cwd(), {
      feed: ({ stdin }) =>
        writeChunks(stdin, 200, seen).catch((e: unknown) => {
          feedError = e
          throw e
        }),
    })
    expect(result).toBeNull()
    await new Promise((r) => setTimeout(r, 50))
    expect(feedError).not.toBeNull()
  })

  it('hands standard output to the caller as it arrives', async () => {
    const binary = writeStandIn(dir, 'process.stdout.write(Buffer.from([1, 2, 3, 250]))')
    const chunks: Buffer[] = []
    const result = await createFfmpegRunner({ binary }).run([], cwd(), {
      output: (chunk) => chunks.push(chunk),
    })
    expect(result).toBe('done')
    expect([...Buffer.concat(chunks)]).toEqual([1, 2, 3, 250])
  })

  it('takes a time limit for one run', async () => {
    const binary = writeStandIn(dir, 'setTimeout(() => {}, 30000)')
    const runner = createFfmpegRunner({ binary })
    const started = Date.now()
    expect(await runner.run([], cwd(), { timeoutMs: 300 })).toBeNull()
    expect(Date.now() - started).toBeLessThan(10_000)
  })
})
