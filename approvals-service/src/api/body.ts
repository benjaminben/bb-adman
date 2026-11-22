// Check 4 of every API request with a body (spec/approvals-service.md "The keyed API"): JSON
// only, at most 4 MiB (round-2-approvals-video.md), read with a cap so a missing or false
// Content-Length cannot get past it.
import { apiError } from './errors'

export const BODY_LIMIT = 4 * 1024 * 1024

export type BodyResult = { ok: true; value: unknown } | { ok: false; reply: Response }

function isJson(request: Request): boolean {
  const type = request.headers.get('Content-Type') ?? ''
  return type.split(';')[0]?.trim().toLowerCase() === 'application/json'
}

// The body's bytes, or null once it passes the limit (the rest is never read).
async function readCapped(request: Request): Promise<Uint8Array | null> {
  if (request.body === null) return new Uint8Array(0)
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > BODY_LIMIT) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let at = 0
  for (const chunk of chunks) {
    bytes.set(chunk, at)
    at += chunk.byteLength
  }
  return bytes
}

export async function readJsonBody(request: Request): Promise<BodyResult> {
  if (!isJson(request)) return { ok: false, reply: apiError(415, 'bad_request') }
  const declared = Number(request.headers.get('Content-Length') ?? 0)
  if (declared > BODY_LIMIT) return { ok: false, reply: apiError(413, 'too_large') }
  const bytes = await readCapped(request)
  if (bytes === null) return { ok: false, reply: apiError(413, 'too_large') }
  try {
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes)
    return { ok: true, value: JSON.parse(text) as unknown }
  } catch {
    return { ok: false, reply: apiError(400, 'invalid_input') }
  }
}
