// Test helper: a stand-in for fetch that answers with recorded Firefly answers
// (tests/fixtures/providers/firefly). Nothing here reaches Adobe.
import fs from 'node:fs'
import type { AdapterContext } from '@/main/providers/types'
import type { Settings } from '@/shared/schemas/settings'

// Made up; they do not look like real credentials.
export const TEST_CLIENT_ID = 'test-client-id-not-real'
export const TEST_CLIENT_SECRET = 'test-client-secret-not-real'
export const TEST_TOKEN = 'made-up-access-token'

// A 1x1 PNG, the same one the Gemini fixtures use.
export const PNG_1X1 = new Uint8Array(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64',
  ),
)

export type SeenRequest = { url: string; method: string; headers: Headers; body: string }

export function first<T>(list: T[]): T {
  const item = list[0]
  if (item === undefined) throw new Error('expected at least one entry')
  return item
}

export function recorded(name: string): unknown {
  const url = new URL(`../../../../fixtures/providers/firefly/${name}`, import.meta.url)
  return JSON.parse(fs.readFileSync(url, 'utf8'))
}

export function recordedError(key: string): unknown {
  return (recorded('errors.json') as Record<string, unknown>)[key]
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export function pngResponse(bytes: Uint8Array = PNG_1X1): Response {
  return new Response(bytes, { status: 200, headers: { 'content-type': 'image/png' } })
}

export function testContext(saved: Record<string, string> = {}): AdapterContext {
  const secrets: Record<string, string> = {
    'firefly.clientId': TEST_CLIENT_ID,
    'firefly.clientSecret': TEST_CLIENT_SECRET,
    ...saved,
  }
  return {
    secret: (name) => {
      const value = secrets[name]
      if (value === undefined) throw new Error(`Secret not saved: ${name}`)
      return value
    },
    settings: () => ({}) as Settings,
    model: (job) => {
      throw new Error(`No default model for firefly ${job}`)
    },
  }
}

export type Route = (request: SeenRequest) => Response | Promise<Response>

// A fetch that records each request and answers with `route(request)`.
export function recordingFetch(route: Route) {
  const seen: SeenRequest[] = []
  const fetchFn = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const body = init?.body === undefined || init.body === null ? '' : String(init.body)
    const request = {
      url: String(input),
      method: init?.method ?? 'GET',
      headers: new Headers(init?.headers),
      body,
    }
    seen.push(request)
    return route(request)
  }
  return { seen, fetchFn }
}

type Answers = { token?: () => Response; submit?: () => Response; statuses?: Response[] }

// Answers each host with the recorded success unless told otherwise: the token, the job, the
// status answers in order (the last one repeats), then the picture.
export function fireflyAnswering(answers: Answers = {}) {
  const statuses = answers.statuses ?? [jsonResponse(recorded('status-succeeded.json'))]
  let polled = 0
  return recordingFetch((request) => {
    const url = new URL(request.url)
    if (url.pathname === '/ims/token/v3') {
      return answers.token?.() ?? jsonResponse(recorded('token-success.json'))
    }
    if (url.pathname === '/v3/images/generate-async') {
      return answers.submit?.() ?? jsonResponse(recorded('generate-accepted.json'), 202)
    }
    if (url.pathname.startsWith('/v3/status/')) {
      const answer = statuses[Math.min(polled, statuses.length - 1)]
      polled += 1
      if (!answer) throw new Error('no status answer')
      return answer.clone()
    }
    return pngResponse()
  })
}

// No real waiting between polls.
export const noWait = async () => undefined
