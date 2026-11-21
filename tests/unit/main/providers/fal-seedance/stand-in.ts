// Test helper: a recorded-answer stand-in for fetch, for the fal.ai adapter. Nothing is sent
// anywhere; each request is recorded and answered by `route`.
import type { AdapterContext } from '@/main/providers/types'
import type { Settings } from '@/shared/schemas/settings'
import { mp4File } from '@/main/providers/fake/mp4'

// Made up; it does not look like a real key.
export const TEST_KEY = 'made-up-fal-value:not-a-key'
export const REQUEST_ID = 'c0ffee00-0000-4000-8000-000000000001'
export const QUEUE = 'https://queue.fal.run'
export const APP = 'bytedance/seedance-2.0'
export const MEDIA_URL = 'https://v3.fal.media/files/made-up/clip.mp4'

export type Seen = {
  url: string
  method: string
  headers: Headers
  body: string | null
  redirect: RequestRedirect | undefined
}

export type Route = (seen: Seen) => Response | Promise<Response>

export function standIn(route: Route) {
  const seen: Seen[] = []
  const fetchFn: typeof fetch = async (input, init) => {
    const request = {
      url: String(input),
      method: init?.method ?? 'GET',
      headers: new Headers(init?.headers),
      body: typeof init?.body === 'string' ? init.body : null,
      redirect: init?.redirect,
    }
    seen.push(request)
    return route(request)
  }
  return { fetchFn, seen }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export const clip = () =>
  new Uint8Array(mp4File({ width: 1280, height: 720, durationMs: 5_000, sound: true }))

export function testContext(key = TEST_KEY): AdapterContext {
  return {
    secret: () => key,
    settings: () => ({}) as Settings,
    model: () => `${APP}/image-to-video`,
  }
}

export function only<T>(list: T[]): T {
  if (list.length !== 1) throw new Error(`expected one entry, got ${list.length}`)
  return list[0] as T
}

// The answers of one whole run: submit, status, result, then the media file.
export function wholeRun(status: unknown = { status: 'COMPLETED' }): Route {
  return (seen) => {
    const path = new URL(seen.url).pathname
    if (seen.method === 'POST') return json({ request_id: REQUEST_ID })
    if (path.endsWith('/status')) return json(status)
    if (path.endsWith(`/requests/${REQUEST_ID}`)) return json({ video: { url: MEDIA_URL } })
    if (seen.url === MEDIA_URL) return new Response(clip(), { status: 200 })
    return json({ detail: 'not recorded' }, 500)
  }
}
