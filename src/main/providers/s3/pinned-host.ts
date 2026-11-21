// SPEC 6 [1.12]: S3 requests may go only to the bucket's own regional AWS host. The AWS
// library takes no `fetch`; it takes a request handler, so the pin is a handler wrapper that
// refuses any other origin before anything is sent. An error thrown by the network call
// itself is marked, and only a marked error can become `offline` or a network `timeout`.
// [1.14] G8, H2: the handler can see the answer body, so it reads the whole body inside the
// marked step and hands the library a finished one; a break during the read is marked too.
import { Readable } from 'node:stream'
import { ProviderFailure } from '../types'

type Request = { protocol: string; hostname: string; port?: number }
export type PinnableHandler = { handle(request: never, options?: never): Promise<unknown> }

const REGION = /^[a-z]{2}(-[a-z0-9]+)+-\d+$/
const BUCKET = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/

export function isRegionName(region: string): boolean {
  return REGION.test(region)
}

export function isBucketName(bucket: string): boolean {
  return BUCKET.test(bucket) && !bucket.includes('..')
}

// The bucket host (virtual-hosted style) and the regional host (path style, which the library
// uses for a bucket name with dots).
export function s3Hosts(bucket: string, region: string): string[] {
  return [`${bucket}.s3.${region}.amazonaws.com`, `s3.${region}.amazonaws.com`]
}

export class NetworkError extends Error {
  readonly code: string
  constructor(cause: unknown) {
    const error = cause instanceof Error ? cause : new Error(String(cause))
    super(error.message, { cause })
    this.name = 'NetworkError'
    this.code = (error as NodeJS.ErrnoException).code ?? error.name
  }
}

export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError
}

export function pinnedHandler(inner: PinnableHandler, hosts: string[]): PinnableHandler {
  return {
    async handle(request: never, options?: never) {
      const { protocol, hostname, port } = request as Request
      const portOk = port === undefined || port === 443
      if (protocol !== 'https:' || !portOk || !hosts.includes(hostname)) {
        throw new ProviderFailure({
          kind: 'other',
          detail: `Request refused: ${protocol}//${hostname}${port ? `:${port}` : ''} is not the S3 host`,
        })
      }
      try {
        return await finished(await inner.handle(request, options))
      } catch (error) {
        throw new NetworkError(error)
      }
    },
  }
}

type Answer = { response?: { body?: unknown } }

function isStream(body: unknown): body is AsyncIterable<Buffer | string> {
  return typeof body === 'object' && body !== null && Symbol.asyncIterator in body
}

// The same answer with its body read in full and handed back as a finished stream.
async function finished(answer: unknown): Promise<unknown> {
  const response = (answer as Answer | undefined)?.response
  if (!response || !isStream(response.body)) return answer
  const chunks: Buffer[] = []
  for await (const chunk of response.body) chunks.push(Buffer.from(chunk))
  response.body = Readable.from([Buffer.concat(chunks)])
  return answer
}
