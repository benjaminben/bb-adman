// P9-8 on the built local storage in a temporary folder: real files read through
// openFileInside, and a cancel or a failure in the middle of a file leaves no half-written
// object and the older file whole.
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { localStorageAt } from '@/main/providers/local-storage'
import { ProviderCancelled } from '@/main/providers/types'
import { LocalFileRefused, openFileInside } from '@/main/publish/open-inside'
import { uploadAll, type UploadFile } from '@/main/publish/upload'
import { recordedPaths, recordingStorage } from '../../../helpers/recording-storage'

const CAMPAIGN = 'summer-sale-a1b2c3'

let base: string
let work: string
let bucket: string

beforeEach(async () => {
  base = await fs.mkdtemp(path.join(os.tmpdir(), 'adman-upload-local-'))
  work = path.join(base, 'work')
  bucket = path.join(base, 'bucket')
  await fs.mkdir(path.join(work, 'exports'), { recursive: true })
  await fs.mkdir(path.join(bucket, CAMPAIGN), { recursive: true })
  await fs.writeFile(path.join(bucket, CAMPAIGN, 'a.png'), 'old published bytes')
})
afterEach(async () => {
  await fs.rm(base, { recursive: true, force: true })
})

const neverSleep = async () => undefined

async function campaignFiles(): Promise<string[]> {
  return (await fs.readdir(path.join(bucket, CAMPAIGN), { recursive: true })).sort()
}

// One chunk, then `next` runs and the stream waits for ever.
function stalling(next: () => void): ReadableStream<Uint8Array> {
  let pulls = 0
  return new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        if (pulls++ === 0) return controller.enqueue(new TextEncoder().encode('half'))
        next()
        return new Promise(() => undefined)
      },
    },
    { highWaterMark: 0 },
  )
}

describe('uploadAll on local storage', () => {
  it('uploads files from the work folder byte for byte, with matching hashes', async () => {
    const bytes = new Uint8Array(200_000).map((_, i) => i % 7)
    await fs.writeFile(path.join(work, 'exports', 'b.png'), bytes)
    const storage = recordingStorage(localStorageAt(bucket))
    const file: UploadFile = {
      path: 'exports/b.png',
      contentType: 'image/png',
      open: () => openFileInside(work, path.join(work, 'exports', 'b.png')),
    }
    const [entry] = await uploadAll(storage, CAMPAIGN, [file], {
      signal: new AbortController().signal,
    })
    const stored = await fs.readFile(path.join(bucket, CAMPAIGN, 'exports', 'b.png'))
    expect(new Uint8Array(stored)).toEqual(bytes)
    expect(entry).toEqual({
      path: 'exports/b.png',
      bytes: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    })
    expect(recordedPaths(storage)).toEqual([`${CAMPAIGN}/exports/b.png`])
  })

  it('leaves no half-written object and the old file whole after a cancel mid-file', async () => {
    const controller = new AbortController()
    const file: UploadFile = {
      path: 'a.png',
      contentType: 'image/png',
      open: () => stalling(() => controller.abort()),
    }
    await expect(
      uploadAll(localStorageAt(bucket), CAMPAIGN, [file], { signal: controller.signal }),
    ).rejects.toBeInstanceOf(ProviderCancelled)
    expect(await campaignFiles()).toEqual(['a.png'])
    expect(await fs.readFile(path.join(bucket, CAMPAIGN, 'a.png'), 'utf8')).toBe(
      'old published bytes',
    )
  })

  it('leaves no half-written object after a file refused part way, with no retry', async () => {
    let opens = 0
    const file: UploadFile = {
      path: 'a.png',
      contentType: 'image/png',
      open() {
        opens++
        let pulls = 0
        return new ReadableStream<Uint8Array>({
          pull(controller) {
            if (pulls++ === 0) return controller.enqueue(new TextEncoder().encode('half'))
            throw new LocalFileRefused()
          },
        })
      },
    }
    await expect(
      uploadAll(localStorageAt(bucket), CAMPAIGN, [file], {
        signal: new AbortController().signal,
        sleep: neverSleep,
      }),
    ).rejects.toBeInstanceOf(LocalFileRefused)
    expect(opens).toBe(1)
    expect(await campaignFiles()).toEqual(['a.png'])
    expect(await fs.readFile(path.join(bucket, CAMPAIGN, 'a.png'), 'utf8')).toBe(
      'old published bytes',
    )
  })

  it('uploads nothing for a link the work folder holds in place of a file', async () => {
    await fs.writeFile(path.join(base, 'private.txt'), 'private bytes')
    await fs.symlink(path.join(base, 'private.txt'), path.join(work, 'exports', 'c.png'))
    const file: UploadFile = {
      path: 'exports/c.png',
      contentType: 'image/png',
      open: () => openFileInside(work, path.join(work, 'exports', 'c.png')),
    }
    await expect(
      uploadAll(localStorageAt(bucket), CAMPAIGN, [file], {
        signal: new AbortController().signal,
      }),
    ).rejects.toBeInstanceOf(LocalFileRefused)
    // The storage may have made the empty folder; it holds no file and no .partial.
    expect((await campaignFiles()).filter((name) => name !== 'exports')).toEqual(['a.png'])
  })
})
