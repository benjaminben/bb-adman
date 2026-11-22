// P9-8: uploads with retries (1, 4, 10 s), a fresh open per attempt, SHA-256 and size counted
// while streaming, and a cancel checked before each file (A-224).
import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { ProviderCancelled, ProviderFailure, type StorageProvider } from '@/main/providers/types'
import { LocalFileRefused } from '@/main/publish/open-inside'
import { RETRY_WAITS_MS, uploadAll, type UploadFile } from '@/main/publish/upload'
import { failureOf } from '../../../helpers/failure-of'
import { recordingStorage } from '../../../helpers/recording-storage'

const CAMPAIGN = 'summer-sale-a1b2c3'

async function drain(data: ReadableStream | Uint8Array): Promise<Uint8Array> {
  if (data instanceof Uint8Array) return data
  const chunks: Uint8Array[] = []
  for await (const chunk of data as unknown as AsyncIterable<Uint8Array>) chunks.push(chunk)
  return new Uint8Array(Buffer.concat(chunks))
}

// A stand-in storage: `fail(attempt)` gives the error of a write attempt, or null to succeed.
function standIn(fail: (attempt: number) => unknown = () => null) {
  const written = new Map<string, { bytes: Uint8Array; contentType: string }>()
  let attempts = 0
  const storage: StorageProvider = {
    exists: async () => false,
    read: async () => new Uint8Array(),
    list: async () => [],
    remove: async () => undefined,
    async write(path, data, contentType) {
      const bytes = await drain(data)
      const error = fail(++attempts)
      if (error) throw error
      written.set(path, { bytes, contentType })
    },
  }
  return { storage: recordingStorage(storage), written, attempts: () => attempts }
}

function fileOf(path: string, text: string, contentType = 'image/png') {
  const bytes = new TextEncoder().encode(text)
  const open = vi.fn(
    () =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes.subarray(0, 3))
          controller.enqueue(bytes.subarray(3))
          controller.close()
        },
      }),
  )
  const file: UploadFile = { path, contentType, open }
  return { file, open, bytes }
}

const offline = () => new ProviderFailure({ kind: 'offline', detail: 'ECONNRESET' })

function options(signal = new AbortController().signal) {
  const sleep = vi.fn(async () => undefined)
  const onProgress = vi.fn()
  return { signal, sleep, onProgress }
}

describe('uploadAll [A-224]', () => {
  it('writes each file in the campaign folder with a size and SHA-256 of its bytes', async () => {
    const { storage, written } = standIn()
    const a = fileOf('exports/post/1080x1080/en-a.png', 'first file bytes')
    const b = fileOf('report.html', '<p>report</p>', 'text/html; charset=utf-8')
    const opts = options()

    const result = await uploadAll(storage, CAMPAIGN, [a.file, b.file], opts)

    const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
    expect(result).toEqual([
      { path: a.file.path, bytes: a.bytes.byteLength, sha256: sha(a.bytes) },
      { path: b.file.path, bytes: b.bytes.byteLength, sha256: sha(b.bytes) },
    ])
    expect(written.get(`${CAMPAIGN}/report.html`)).toEqual({
      bytes: b.bytes,
      contentType: 'text/html; charset=utf-8',
    })
    expect(storage.calls.every((c) => c.paths.every((p) => p.startsWith(`${CAMPAIGN}/`)))).toBe(
      true,
    )
    expect(opts.onProgress.mock.calls).toEqual([[0.5], [1]])
    expect(opts.sleep).not.toHaveBeenCalled()
  })

  it('waits 1, 4 and 10 s between attempts, then fails with the last failure', async () => {
    const { storage, attempts } = standIn(() => offline())
    const a = fileOf('report.html', 'x')
    const opts = options()
    const error = await failureOf(uploadAll(storage, CAMPAIGN, [a.file], opts))
    expect(error).toEqual({ kind: 'offline', detail: 'ECONNRESET' })
    expect(RETRY_WAITS_MS).toEqual([1000, 4000, 10_000])
    expect(opts.sleep.mock.calls.map((call) => call[0])).toEqual([1000, 4000, 10_000])
    expect(attempts()).toBe(4)
    expect(a.open).toHaveBeenCalledTimes(4)
  })

  it('opens the file again for each attempt and succeeds after two failures', async () => {
    const { storage, written } = standIn((n) => (n <= 2 ? offline() : null))
    const a = fileOf('report.json', '{"a":1}')
    const opts = options()
    const [done] = await uploadAll(storage, CAMPAIGN, [a.file], opts)
    expect(a.open).toHaveBeenCalledTimes(3)
    expect(opts.sleep.mock.calls.map((call) => call[0])).toEqual([1000, 4000])
    expect(done.bytes).toBe(7)
    expect(written.get(`${CAMPAIGN}/report.json`)?.bytes).toEqual(a.bytes)
  })

  it('does not retry dropbox_signed_out', async () => {
    const signedOut = new ProviderFailure({
      kind: 'bad_key',
      reason: 'dropbox_signed_out',
      detail: '400 invalid_grant',
    })
    const { storage, attempts } = standIn(() => signedOut)
    const opts = options()
    const error = await failureOf(uploadAll(storage, CAMPAIGN, [fileOf('a.png', 'x').file], opts))
    expect(error.reason).toBe('dropbox_signed_out')
    expect(attempts()).toBe(1)
    expect(opts.sleep).not.toHaveBeenCalled()
  })

  it('does not retry a refused local file, and writes nothing for it', async () => {
    const { storage, written } = standIn()
    const refused: UploadFile = {
      path: 'a.png',
      contentType: 'image/png',
      open: vi.fn(
        () =>
          new ReadableStream<Uint8Array>({
            pull() {
              throw new LocalFileRefused()
            },
          }),
      ),
    }
    const opts = options()
    await expect(uploadAll(storage, CAMPAIGN, [refused], opts)).rejects.toBeInstanceOf(
      LocalFileRefused,
    )
    expect(refused.open).toHaveBeenCalledTimes(1)
    expect(opts.sleep).not.toHaveBeenCalled()
    expect(written.size).toBe(0)
  })

  it('turns a storage error that is not a ProviderFailure into one with no words of its own', async () => {
    const raw = Object.assign(new Error('EACCES: open /Users/ann/secret-folder/a.png'), {
      code: 'EACCES',
    })
    const { storage } = standIn(() => raw)
    const error = await failureOf(
      uploadAll(storage, CAMPAIGN, [fileOf('a.png', 'x').file], options()),
    )
    expect(error).toEqual({ kind: 'other', detail: 'EACCES' })
    const plain = standIn(() => new Error('https://bucket.example.com/a.png?X-Amz-Signature=abc'))
    const second = await failureOf(
      uploadAll(plain.storage, CAMPAIGN, [fileOf('a.png', 'x').file], options()),
    )
    expect(second).toEqual({ kind: 'other', detail: 'upload_failed' })
  })

  it('stops before the next file once cancelled, opening it never', async () => {
    const { storage, written } = standIn()
    const controller = new AbortController()
    const a = fileOf('a.png', 'a')
    const b = fileOf('b.png', 'b')
    const opts = { ...options(controller.signal), onProgress: () => controller.abort() }
    await expect(uploadAll(storage, CAMPAIGN, [a.file, b.file], opts)).rejects.toBeInstanceOf(
      ProviderCancelled,
    )
    expect(b.open).not.toHaveBeenCalled()
    expect([...written.keys()]).toEqual([`${CAMPAIGN}/a.png`])
  })

  it('stops during a retry wait once cancelled, with no more attempts', async () => {
    const { storage, attempts } = standIn(() => offline())
    const controller = new AbortController()
    const opts = { ...options(controller.signal), sleep: vi.fn(async () => controller.abort()) }
    await expect(
      uploadAll(storage, CAMPAIGN, [fileOf('a.png', 'a').file], opts),
    ).rejects.toBeInstanceOf(ProviderCancelled)
    expect(attempts()).toBe(1)
  })

  it('does nothing when cancelled before it starts', async () => {
    const { storage } = standIn()
    const controller = new AbortController()
    controller.abort()
    const a = fileOf('a.png', 'a')
    await expect(
      uploadAll(storage, CAMPAIGN, [a.file], options(controller.signal)),
    ).rejects.toBeInstanceOf(ProviderCancelled)
    expect(a.open).not.toHaveBeenCalled()
    expect(storage.calls).toEqual([])
  })

  const refusedLists: Array<[string, string, string[]]> = [
    ['manifest.json', CAMPAIGN, ['a.png', 'manifest.json']],
    ['manifest.json in another case', CAMPAIGN, ['Manifest.JSON']],
    ['a path that climbs out', CAMPAIGN, ['../other-campaign-zzzzzz/a.png']],
    ['a leading slash', CAMPAIGN, ['/a.png']],
    ['the same path twice, case folded', CAMPAIGN, ['exports/a.png', 'Exports/A.png']],
    ['a campaign ID with a slash', 'a/b', ['a.png']],
    ['an empty campaign ID', '', ['a.png']],
  ]

  it.each(refusedLists)(
    'refuses %s before anything is opened or written',
    async (_name, campaignId, paths) => {
      const { storage } = standIn()
      const files = paths.map((p) => fileOf(p, 'x'))
      await expect(
        uploadAll(
          storage,
          campaignId,
          files.map((f) => f.file),
          options(),
        ),
      ).rejects.toThrow('Storage path refused')
      expect(storage.calls).toEqual([])
      for (const f of files) expect(f.open).not.toHaveBeenCalled()
    },
  )
})
