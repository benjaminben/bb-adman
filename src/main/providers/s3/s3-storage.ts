// SPEC 6, 6.5: StorageProvider on an S3 bucket. Settings give bucket, region and an optional
// prefix (the root); the keys come only from ctx.secret, never from the environment or a file.
// Calls: HeadObject (exists), GetObject (read), lib-storage Upload (write, multipart when
// large), ListObjectsV2 (list), DeleteObjects (remove). The SDK is told to send each call
// once: the adapter never repeats a call (SPEC 6, retry rule).
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
  S3ServiceException,
  type S3ClientConfig,
} from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { storageFilePath, storageListPrefix } from '../local-storage/paths'
import type { AdapterContext, StorageProvider } from '../types'
import { failureFromS3Error, kindForCode, s3Failure } from './failure'

const DELETE_BATCH = 1000 // DeleteObjects takes at most 1000 keys per call

// Socket limits for the real HTTP handler; tests hand in a stand-in instead.
const DEFAULT_HANDLER = { connectionTimeout: 10_000, requestTimeout: 60_000 }

type Options = { requestHandler?: S3ClientConfig['requestHandler'] }

function rootOf(prefix: string): string {
  return prefix.replace(/^\/+|\/+$/g, '')
}

export function s3Storage(ctx: AdapterContext, options: Options = {}): StorageProvider {
  const settings = ctx.settings().storage.s3
  if (!settings || settings.bucket === '') throw new Error('S3 storage is not set up')
  const accessKeyId = ctx.secret('s3.accessKeyId')
  const secretAccessKey = ctx.secret('s3.secretAccessKey')
  const keys = [accessKeyId, secretAccessKey]
  const client = new S3Client({
    region: settings.region,
    credentials: { accessKeyId, secretAccessKey },
    maxAttempts: 1,
    requestHandler: options.requestHandler ?? DEFAULT_HANDLER,
  })
  const Bucket = settings.bucket
  const root = rootOf(settings.prefix)
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

    async read(path) {
      const Key = keyFor(storageFilePath(path))
      return run(async () => {
        const answer = await client.send(new GetObjectCommand({ Bucket, Key }))
        if (!answer.Body) throw new Error('GetObject gave no body')
        return answer.Body.transformToByteArray()
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
        for (const item of page.Contents ?? []) {
          if (item.Key?.startsWith(Prefix)) found.push(item.Key.slice(rootLength))
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
  }
}
