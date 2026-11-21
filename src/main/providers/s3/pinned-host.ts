// SPEC 6 [1.12]: S3 requests may go only to the bucket's own regional AWS host. The AWS
// library takes no `fetch`; it takes a request handler, so the pin is a handler wrapper that
// refuses any other origin before anything is sent. An error thrown by the network call
// itself is marked, and only a marked error can become `offline` or a network `timeout`.
// [1.14] G8, H2: the handler can see the answer body, so it reads the whole body inside the
// marked step and hands the library a finished one; a break during the read is marked too.
import { Readable } from 'node:stream'
import { ProviderFailure } from '@/main/providers/types'

type Request = { protocol: string; hostname: string; port?: number }
export type PinnableHandler = { handle(request: never, options?: never): Promise<unknown> }

const REGION = /^[a-z]{2}(-[a-z0-9]+)+-\d+$/
const BUCKET = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/

export function isRegionName(region: string): boolean {
  return REGION.test(region)
}

// SPEC 14 1.39 "S3" [FR-308]: the words settings.update gives for a region this build does not
// support, or null for a standard Amazon region. client.ts keeps its own check as a second guard.
// [1.40] AA6: the empty region is null too; it is saved and caught as not set up when used.
export function regionRefusal(region: string): string | null {
  if (region === '') return null
  if (region.startsWith('cn-')) return 'Amazon S3 regions in China are not supported in this build.'
  if (isRegionName(region)) return null
  return 'That is not an Amazon S3 region. Storage services that copy S3 are not supported in this build.'
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
      // [1.16] H19: only the network call and the body read are marked; handing back the
      // finished answer is not, so an error there stays `other`.
      let answer: unknown
      let body: Buffer | undefined
      try {
        answer = await inner.handle(request, options)
        body = await readBody(answer)
      } catch (error) {
        throw new NetworkError(error)
      }
      return finished(answer, body)
    },
  }
}

type Answer = { response?: { body?: unknown } }

function isStream(body: unknown): body is AsyncIterable<Buffer | string> {
  return typeof body === 'object' && body !== null && Symbol.asyncIterator in body
}

// The whole answer body, or undefined when the answer has no stream to read.
async function readBody(answer: unknown): Promise<Buffer | undefined> {
  const body = (answer as Answer | undefined)?.response?.body
  if (!isStream(body)) return undefined
  const chunks: Buffer[] = []
  for await (const chunk of body) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
}

// The same answer with its body handed back as a finished stream.
function finished(answer: unknown, body: Buffer | undefined): unknown {
  const response = (answer as Answer | undefined)?.response
  if (response && body !== undefined) response.body = Readable.from([body])
  return answer
}
