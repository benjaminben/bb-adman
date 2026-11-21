// Test helper: a stand-in for the AWS SDK's HTTP handler that answers with recorded S3
// responses (tests/fixtures/providers/s3). Every request goes through the real
// @aws-sdk/client-s3 and @aws-sdk/lib-storage code: signing, building and parsing.
import fs from 'node:fs'
import { Readable } from 'node:stream'
import type { AdapterContext } from '../../../../../src/main/providers/types'
import type { Settings } from '../../../../../src/shared/schemas/settings'

// Made up; they do not look like real keys.
export const TEST_KEY_ID = 'test-id-not-a-key'
export const TEST_SECRET = 'test-secret-not-a-key'
export const TEST_BUCKET = 'made-up-bucket'

export type SeenRequest = {
  method: string
  hostname: string
  path: string
  query: Record<string, string | string[] | null>
  headers: Record<string, string>
  body: Uint8Array
}

export type Answer = {
  status: number
  headers?: Record<string, string>
  body?: string | Uint8Array
}

export function recorded(name: string): string {
  const url = new URL(`../../../../fixtures/providers/s3/${name}`, import.meta.url)
  return fs.readFileSync(url, 'utf8')
}

export function xml(name: string, status = 200): Answer {
  return { status, headers: { 'content-type': 'application/xml' }, body: recorded(name) }
}

export const ok = (headers: Record<string, string> = {}): Answer => ({ status: 200, headers })

export function testContext(prefix = 'made-up-prefix', secrets: Record<string, string> = {}) {
  const saved: Record<string, string> = {
    's3.accessKeyId': TEST_KEY_ID,
    's3.secretAccessKey': TEST_SECRET,
    ...secrets,
  }
  const settings = {
    storage: { s3: { bucket: TEST_BUCKET, region: 'eu-west-1', prefix }, dropbox: null },
  } as unknown as Settings
  const ctx: AdapterContext = {
    secret(name) {
      const value = saved[name]
      if (value === undefined) throw new Error(`no test secret ${name}`)
      return value
    },
    settings: () => settings,
    model: () => 'none',
  }
  return ctx
}

async function bytesOf(body: unknown): Promise<Uint8Array> {
  if (body === undefined || body === null) return new Uint8Array()
  if (typeof body === 'string') return new TextEncoder().encode(body)
  if (body instanceof Uint8Array) return new Uint8Array(body)
  const chunks: Buffer[] = []
  for await (const chunk of body as AsyncIterable<Buffer | string>) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk))
  }
  return new Uint8Array(Buffer.concat(chunks))
}

type SdkRequest = {
  method: string
  hostname: string
  path: string
  query: SeenRequest['query']
  headers: Record<string, string>
  body?: unknown
}

// A handler that records each request and answers with `answer(request)`, in order.
// An answer that is an Error is thrown, as a network failure would be.
export function recordingHandler(answer: (request: SeenRequest) => Answer | Error) {
  const seen: SeenRequest[] = []
  const requestHandler = {
    async handle(request: SdkRequest) {
      const entry: SeenRequest = {
        method: request.method,
        hostname: request.hostname,
        path: request.path,
        query: request.query,
        headers: request.headers,
        body: await bytesOf(request.body),
      }
      seen.push(entry)
      const reply = answer(entry)
      if (reply instanceof Error) throw reply
      const body = typeof reply.body === 'string' ? Buffer.from(reply.body) : reply.body
      return {
        response: {
          statusCode: reply.status,
          headers: reply.headers ?? {},
          body: Readable.from(body ? [Buffer.from(body)] : []),
        },
      }
    },
  }
  return { seen, requestHandler }
}

// Answers the requests in order with the given list; fails the test past its end.
export function handlerAnswering(...answers: Array<Answer | Error>) {
  let next = 0
  return recordingHandler(() => {
    const reply = answers[next]
    next += 1
    if (reply === undefined) throw new Error(`unexpected request number ${next}`)
    return reply
  })
}
