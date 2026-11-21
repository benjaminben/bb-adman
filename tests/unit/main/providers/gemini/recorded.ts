// Test helper: a stand-in for fetch that answers with a recorded Gemini response
// (tests/fixtures/providers/gemini). Every request goes through the real @google/genai SDK.
import fs from 'node:fs'
import type { AdapterContext } from '../../../../../src/main/providers/types'
import type { Settings } from '../../../../../src/shared/schemas/settings'

// Made up; it does not look like a real key.
export const TEST_KEY = 'test-value-not-a-key'
export const TEST_MODEL = 'made-up-image-model'

export type SeenRequest = { url: string; headers: Headers; body: Record<string, unknown> }

// The first entry of a list; fails the test when the list is empty.
export function first<T>(list: T[]): T {
  const item = list[0]
  if (item === undefined) throw new Error('expected at least one entry')
  return item
}

export function recorded(name: string): unknown {
  const url = new URL(`../../../../fixtures/providers/gemini/${name}`, import.meta.url)
  return JSON.parse(fs.readFileSync(url, 'utf8'))
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export function testContext(): AdapterContext {
  return {
    secret: () => TEST_KEY,
    settings: () => ({}) as Settings,
    model: () => TEST_MODEL,
  }
}

// A fetch that records each request and answers with `answer()`.
export function recordingFetch(answer: (signal: AbortSignal | undefined) => Promise<Response>) {
  const seen: SeenRequest[] = []
  const fetchFn = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {}
    seen.push({ url: String(input), headers: new Headers(init?.headers), body })
    return answer(init?.signal ?? undefined)
  }
  return { seen, fetchFn }
}

// Answers every request with the same recorded file and status.
export function fetchAnswering(name: string, status = 200) {
  return recordingFetch(async () => jsonResponse(recorded(name), status))
}

// Never answers; rejects when the request is aborted, as the real fetch does.
export function fetchThatHangs() {
  return recordingFetch(
    (signal) =>
      new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener('abort', () => {
          reject(new DOMException('This operation was aborted', 'AbortError'))
        })
      }),
  )
}
