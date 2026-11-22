// The upload engine (spec/phases/phase-09.md "Publishing", uploads; A-224). Writes each file
// the caller listed to {campaignId}/{path} through the storage port, and nothing else: every
// path is checked before the first write, and manifest.json is never one of them (the
// manifest is written last, by writeManifest). Each attempt opens the file again, and the
// size and SHA-256 are counted from the bytes as they stream to the storage. A failure is
// tried again after 1, 4 and 10 s, except dropbox_signed_out and a refused local file. A
// cancel is checked before each file and each attempt, and ends a write that is under way,
// so the storage drops its half-written object where it can.
import { createHash } from 'node:crypto'
import { errnoCode } from '@/main/jobs/local-failure'
import { refusePath, storageFilePath } from '@/main/providers/storage-paths'
import { ProviderCancelled, ProviderFailure, type StorageProvider } from '@/main/providers/types'
import { MANIFEST_NAME, type ManifestFile } from '@/shared/publish/manifest'
import { campaignPrefix } from './manifest'
import { LocalFileRefused } from './open-inside'

export const RETRY_WAITS_MS = [1000, 4000, 10_000]

// `path` is relative to {campaignId}/. `open` gives the file's bytes, fresh for each attempt.
export type UploadFile = { path: string; contentType: string; open(): ReadableStream<Uint8Array> }

export type UploadOptions = {
  signal: AbortSignal
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>
  // The fraction of the files uploaded, after each file.
  onProgress?: (fraction: number) => void
}

function waitFor(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        resolve()
      },
      { once: true },
    )
  })
}

// The full storage path of each file, refused as a whole before anything is written.
function targetsOf(
  campaignId: string,
  files: UploadFile[],
): Array<{ file: UploadFile; target: string }> {
  const prefix = campaignPrefix(campaignId)
  const seen = new Set<string>([MANIFEST_NAME])
  return files.map((file) => {
    const folded = file.path.toLowerCase()
    if (seen.has(folded)) refusePath()
    seen.add(folded)
    return { file, target: storageFilePath(`${prefix}${file.path}`) }
  })
}

// The failure an attempt ends with. A storage error that is not a ProviderFailure keeps only
// its error code, never its message, which may hold a path or an address.
function failureOf(error: unknown): ProviderFailure | LocalFileRefused {
  if (error instanceof ProviderFailure || error instanceof LocalFileRefused) return error
  return new ProviderFailure({ kind: 'other', detail: errnoCode(error) ?? 'upload_failed' })
}

const retried = (failure: ProviderFailure | LocalFileRefused) =>
  failure instanceof ProviderFailure && failure.error.reason !== 'dropbox_signed_out'

async function attempt(
  storage: StorageProvider,
  target: string,
  file: UploadFile,
  signal: AbortSignal,
): Promise<ManifestFile> {
  const hash = createHash('sha256')
  let bytes = 0
  let refused = false
  const reader = file.open().getReader()
  const stop = () => void reader.cancel().catch(() => undefined)
  signal.addEventListener('abort', stop, { once: true })
  // The storage reads this; a cancel or a refused file makes the read fail, so the storage
  // drops what it has written of this file.
  const counted = new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        try {
          if (signal.aborted) throw new ProviderCancelled()
          const { done, value } = await reader.read()
          if (signal.aborted) throw new ProviderCancelled()
          if (done) return controller.close()
          hash.update(value)
          bytes += value.byteLength
          controller.enqueue(value)
        } catch (error) {
          if (error instanceof LocalFileRefused) refused = true
          throw error
        }
      },
      cancel: (reason) => reader.cancel(reason),
    },
    { highWaterMark: 0 },
  )
  try {
    await storage.write(target, counted, file.contentType)
  } catch (error) {
    throw refused ? new LocalFileRefused() : error
  } finally {
    signal.removeEventListener('abort', stop)
  }
  return { path: file.path, bytes, sha256: hash.digest('hex') }
}

async function uploadOne(
  storage: StorageProvider,
  target: string,
  file: UploadFile,
  opts: UploadOptions,
): Promise<ManifestFile> {
  const sleep = opts.sleep ?? waitFor
  for (let tries = 0; ; tries++) {
    if (opts.signal.aborted) throw new ProviderCancelled()
    try {
      return await attempt(storage, target, file, opts.signal)
    } catch (error) {
      if (opts.signal.aborted) throw new ProviderCancelled()
      const failure = failureOf(error)
      const wait = RETRY_WAITS_MS[tries]
      if (!retried(failure) || wait === undefined) throw failure
      await sleep(wait, opts.signal)
    }
  }
}

// Uploads every file in order and gives each one's manifest entry.
export async function uploadAll(
  storage: StorageProvider,
  campaignId: string,
  files: UploadFile[],
  opts: UploadOptions,
): Promise<ManifestFile[]> {
  const targets = targetsOf(campaignId, files)
  const done: ManifestFile[] = []
  for (const [index, { file, target }] of targets.entries()) {
    if (opts.signal.aborted) throw new ProviderCancelled()
    done.push(await uploadOne(storage, target, file, opts))
    opts.onProgress?.((index + 1) / files.length)
  }
  return done
}
