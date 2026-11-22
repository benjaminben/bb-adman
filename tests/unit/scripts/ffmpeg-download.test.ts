import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'

type Fetch = (url: string, init?: RequestInit) => Promise<Response>
type DownloadModule = {
  download: (options: {
    url: string
    sha256: string
    dest: string
    fetchImpl?: Fetch
    maxBytes?: number
  }) => Promise<string>
  hashFile: (file: string) => Promise<string>
}

const modulePath = path.resolve('scripts/ffmpeg/download.mjs')
const { download, hashFile } = (await import(/* @vite-ignore */ modulePath)) as DownloadModule

const body = Buffer.from('pinned archive bytes')
const bodyHash = crypto.createHash('sha256').update(body).digest('hex')
const start = 'https://github.com/FFmpeg-Builds/FFmpeg-Builds/releases/download/a/x.zip'

let folder = ''
afterEach(() => {
  if (folder) fs.rmSync(folder, { recursive: true, force: true })
})

function dest(): string {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'download-'))
  return path.join(folder, 'archive')
}

function redirect(location: string): Response {
  return new Response(null, { status: 302, headers: { location } })
}

// A stand-in fetch: answers from a table by address and records every call.
function standIn(answers: Record<string, () => Response>, calls: [string, RequestInit?][]): Fetch {
  return async (url, init) => {
    calls.push([url, init])
    const answer = answers[url]
    if (!answer) throw new Error(`unexpected request to ${url}`)
    return answer()
  }
}

function streamOf(chunks: Buffer[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new Uint8Array(chunk))
      controller.close()
    },
  })
}

describe('download [P7-3]', () => {
  it('follows a redirect to a listed host, checks the hash and keeps the file', async () => {
    const file = dest()
    const assets = 'https://release-assets.githubusercontent.com/a/b?sig=1'
    const calls: [string, RequestInit?][] = []
    const fetchImpl = standIn(
      { [start]: () => redirect(assets), [assets]: () => new Response(body) },
      calls,
    )
    expect(await download({ url: start, sha256: bodyHash, dest: file, fetchImpl })).toBe(file)
    expect(fs.readFileSync(file)).toEqual(body)
    expect(calls.map(([u]) => u)).toEqual([start, assets])
    for (const [, init] of calls) expect(init?.redirect).toBe('manual')
  })

  it.each([
    ['an unlisted host', 'https://example.com/x.zip'],
    ['an http: address on a listed host', 'http://release-assets.githubusercontent.com/x'],
    ['a look-alike host', 'https://github.com.example.com/x'],
  ])('refuses a redirect to %s without requesting it', async (_name, location) => {
    const file = dest()
    const calls: [string, RequestInit?][] = []
    const fetchImpl = standIn({ [start]: () => redirect(location) }, calls)
    await expect(
      download({ url: start, sha256: bodyHash, dest: file, fetchImpl }),
    ).rejects.toThrow()
    expect(calls).toHaveLength(1)
    expect(fs.existsSync(file)).toBe(false)
  })

  it('refuses a start address on an unlisted host before any request', async () => {
    const calls: [string, RequestInit?][] = []
    const fetchImpl = standIn({}, calls)
    const url = 'https://example.com/x.zip'
    await expect(download({ url, sha256: bodyHash, dest: dest(), fetchImpl })).rejects.toThrow()
    expect(calls).toHaveLength(0)
  })

  it('stops after too many redirects', async () => {
    const hop = 'https://github.com/FFmpeg-Builds/FFmpeg-Builds/releases/download/a/y.zip'
    const fetchImpl = standIn({ [start]: () => redirect(hop), [hop]: () => redirect(start) }, [])
    await expect(
      download({ url: start, sha256: bodyHash, dest: dest(), fetchImpl }),
    ).rejects.toThrow(/redirect/i)
  })

  it('refuses an answer that is not 200', async () => {
    const file = dest()
    const fetchImpl = standIn({ [start]: () => new Response('no', { status: 404 }) }, [])
    await expect(
      download({ url: start, sha256: bodyHash, dest: file, fetchImpl }),
    ).rejects.toThrow()
    expect(fs.existsSync(file)).toBe(false)
  })

  it('stops an answer whose stated length is over the limit', async () => {
    const file = dest()
    const big = () => new Response(body, { headers: { 'content-length': '1000' } })
    const fetchImpl = standIn({ [start]: big }, [])
    await expect(
      download({ url: start, sha256: bodyHash, dest: file, fetchImpl, maxBytes: 999 }),
    ).rejects.toThrow(/limit/i)
    expect(fs.existsSync(file)).toBe(false)
  })

  it('stops an oversize answer with no stated length and deletes the part written', async () => {
    const file = dest()
    const chunks = [Buffer.alloc(8, 1), Buffer.alloc(8, 2), Buffer.alloc(8, 3)]
    const fetchImpl = standIn({ [start]: () => new Response(streamOf(chunks)) }, [])
    await expect(
      download({ url: start, sha256: bodyHash, dest: file, fetchImpl, maxBytes: 20 }),
    ).rejects.toThrow(/limit/i)
    expect(fs.existsSync(file)).toBe(false)
  })

  it('refuses a wrong hash and deletes the file', async () => {
    const file = dest()
    const fetchImpl = standIn({ [start]: () => new Response(body) }, [])
    const wrong = 'b'.repeat(64)
    await expect(download({ url: start, sha256: wrong, dest: file, fetchImpl })).rejects.toThrow(
      /SHA-256/,
    )
    expect(fs.existsSync(file)).toBe(false)
  })

  it('never writes over a file already there', async () => {
    const file = dest()
    fs.writeFileSync(file, 'earlier')
    const fetchImpl = standIn({ [start]: () => new Response(body) }, [])
    await expect(
      download({ url: start, sha256: bodyHash, dest: file, fetchImpl }),
    ).rejects.toThrow()
    expect(fs.readFileSync(file, 'utf8')).toBe('earlier')
  })

  it('hashFile gives the SHA-256 of a file as hex', async () => {
    const file = dest()
    fs.writeFileSync(file, body)
    expect(await hashFile(file)).toBe(bodyHash)
  })
})
