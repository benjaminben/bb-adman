import 'server-only'
// spec/approvals-service-visitor.md "Pictures", "Fetching": today's only PictureSource. The stored
// address is parsed once; the check runs on that object right before the fetch, and that same
// object is fetched. The address is never put in a reply, a log line or an error.
import type { Env } from '../env'
import { checkPictureUrl } from './check-url'
import { sniff } from './sniff'
import type { Picture, PictureSource } from './source'

export const PICTURE_LIMIT = 16 * 1024 * 1024

function parse(text: string): URL | null {
  try {
    return new URL(text)
  } catch {
    return null
  }
}

// The body, or null once it passes the limit (the rest is never read).
async function readCapped(body: ReadableStream<Uint8Array>): Promise<Uint8Array | null> {
  const reader = body.getReader()
  const pieces: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > PICTURE_LIMIT) {
      await reader.cancel()
      return null
    }
    pieces.push(value)
  }
  const bytes = new Uint8Array(size)
  let at = 0
  for (const piece of pieces) {
    bytes.set(piece, at)
    at += piece.byteLength
  }
  return bytes
}

async function fetchPicture(text: string, env: Env): Promise<Picture | null> {
  const url = parse(text)
  // The check reads the object's own text, and it must come back unchanged: what was checked is
  // exactly what is fetched.
  if (url === null || checkPictureUrl(url.href, env) !== url.href) return null
  // No header, no cookie, nothing from the visitor's request. No `cache` option either: the
  // Fetch standard makes `no-store` add Pragma and Cache-Control. Under Node a redirect comes
  // back as its real 3xx status, which fails below.
  const reply = await fetch(url, { redirect: 'manual' })
  if (reply.status !== 200 || reply.body === null) {
    await reply.body?.cancel()
    return null
  }
  if (Number(reply.headers.get('Content-Length') ?? 0) > PICTURE_LIMIT) {
    await reply.body.cancel()
    return null
  }
  const bytes = await readCapped(reply.body)
  if (bytes === null) return null
  const type = sniff(bytes)
  return type === null ? null : { bytes, type }
}

export function s3Source(env: Env): PictureSource {
  return {
    async get(ref) {
      try {
        return await fetchPicture(ref.url, env)
      } catch {
        // A network failure's message may hold the address: nothing of it goes on.
        return null
      }
    },
  }
}
