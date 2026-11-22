// SPEC 6, 6.5: StorageProvider on an S3 bucket. Settings give bucket, region and an optional
// prefix (the root); the keys come only from ctx.secret, never from the environment or a file.
// Calls: HeadObject (exists), GetObject (read), lib-storage Upload (write, multipart when
// large), ListObjectsV2 (list), DeleteObjects (remove). The client (client.ts) sends each call
// once (SPEC 6, retry rule) and only to the pinned host (SPEC 6 [1.12]).
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3ServiceException,
} from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { storageFilePath, storageListPrefix } from '@/main/providers/storage-paths'
import { readLimited } from '@/main/providers/read-limited'
import {
  STORAGE_READ_MAX_BYTES,
  type AdapterContext,
  type StorageProvider,
} from '@/main/providers/types'
import { buildS3Client } from './client'
import { failureFromS3Error, kindForCode, s3Failure } from './failure'
import type { PinnableHandler } from './pinned-host'
import { signReadUrl } from './signed-url'

const DELETE_BATCH = 1000 // DeleteObjects takes at most 1000 keys per call

type Options = { requestHandler?: PinnableHandler }

export function s3Storage(ctx: AdapterContext, options: Options = {}): StorageProvider {
  const { client, bucket: Bucket, root, keys } = buildS3Client(ctx, options.requestHandler)
  const keyFor = (path: string) => (root === '' ? path : `${root}/${path}`)
  const rootLength = root === '' ? 0 : root.length + 1

  async function run<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call()
    } catch (error) {
      throw failureFromS3Error(error, keys)
    }
  }

  return {
    async exists(path) {
      const Key = keyFor(storageFilePath(path))
      try {
        await client.send(new HeadObjectCommand({ Bucket, Key }))
        return true
      } catch (error) {
        if (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404) {
          return false
        }
        throw failureFromS3Error(error, keys)
      }
    },

    // The stated length is checked before any byte is read; the body is counted as it comes.
    async read(path, maxBytes = STORAGE_READ_MAX_BYTES) {
      const Key = keyFor(storageFilePath(path))
      return run(async () => {
        const answer = await client.send(new GetObjectCommand({ Bucket, Key }))
        if (!answer.Body) throw new Error('GetObject gave no body')
        const headers = new Headers()
        if (answer.ContentLength !== undefined) {
          headers.set('content-length', String(answer.ContentLength))
        }
        const body = new Response(answer.Body.transformToWebStream(), { headers })
        return new Uint8Array(await readLimited(body, maxBytes))
      })
    },

    async write(path, data, contentType) {
      const Key = keyFor(storageFilePath(path))
      await run(() =>
        new Upload({
          client,
          params: { Bucket, Key, Body: data, ContentType: contentType },
        }).done(),
      )
    },

    async list(prefix) {
      const Prefix = keyFor(storageListPrefix(prefix))
      const found: string[] = []
      let ContinuationToken: string | undefined
      do {
        const page = await run(() =>
          client.send(new ListObjectsV2Command({ Bucket, Prefix, ContinuationToken })),
        )
        // [1.14] H12: a key that ends in '/' is a folder marker, not a file.
        for (const item of page.Contents ?? []) {
          const key = item.Key
          if (key?.startsWith(Prefix) && !key.endsWith('/')) found.push(key.slice(rootLength))
        }
        ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined
      } while (ContinuationToken)
      return found
    },

    async remove(paths) {
      const all = paths.map((path) => ({ Key: keyFor(storageFilePath(path)) }))
      for (let start = 0; start < all.length; start += DELETE_BATCH) {
        const Objects = all.slice(start, start + DELETE_BATCH)
        const answer = await run(() =>
          client.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects, Quiet: true } })),
        )
        const failed = answer.Errors?.[0]
        if (failed) {
          const code = failed.Code ?? 'Unknown'
          const detail = `DeleteObjects ${answer.Errors?.length} failed, first ${code}: ${failed.Message}`
          throw s3Failure(kindForCode(code), detail, keys)
        }
      }
    },

    // spec/approvals.md "Pictures": signed on this machine; nothing is sent.
    async signedReadUrl(path, seconds) {
      return signReadUrl({ client, bucket: Bucket, keys }, keyFor(storageFilePath(path)), seconds)
    },
  }
}
