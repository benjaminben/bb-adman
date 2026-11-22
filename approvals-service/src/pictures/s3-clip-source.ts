import 'server-only'
// round-2-approvals-video.md "The clip route (service)": today's only ClipSource. The stored
// address is parsed once; the check runs on that object right before the fetch, and that same
// object is fetched. The address and the bucket's reply headers never reach a reply, a log line
// or an error.
import type { Env } from '../env'
import { checkPictureUrl } from './check-url'
import type { ClipRange, ClipSource } from './clip-source'

const FTYP = [0x66, 0x74, 0x79, 0x70]

function parse(text: string): URL | null {
  try {
    return new URL(text)
  } catch {
    return null
  }
}

// Exactly `size` bytes, or null. Reading stops as soon as the body runs past `size`.
async function readExactly(body: ReadableStream<Uint8Array>, size: number) {
  const reader = body.getReader()
  const bytes = new Uint8Array(size)
  let at = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (at + value.byteLength > size) {
      await reader.cancel()
      return null
    }
    bytes.set(value, at)
    at += value.byteLength
  }
  return at === size ? bytes : null
}

// An MP4 starts with its `ftyp` box: bytes 4 to 7. Only a piece from 0 can be sniffed.
function looksLikeMp4(bytes: Uint8Array, start: number): boolean {
  if (start !== 0 || bytes.byteLength < 8) return true
  return FTYP.every((byte, i) => bytes[4 + i] === byte)
}

async function fetchPiece(text: string, env: Env, range: ClipRange) {
  const { start, end, total } = range
  const url = parse(text)
  // The check reads the object's own text, and it must come back unchanged: what was checked is
  // exactly what is fetched.
  if (url === null || checkPictureUrl(url.href, env) !== url.href) return null
  const size = end - start + 1
  // Range is the only header, built from two whole numbers; nothing of the visitor's request.
  // Under Node a redirect comes back as its real 3xx status, which fails below.
  const reply = await fetch(url, {
    redirect: 'manual',
    headers: { Range: `bytes=${start}-${end}` },
  })
  const length = reply.headers.get('Content-Length')
  const exact =
    reply.status === 206 &&
    reply.headers.get('Content-Range') === `bytes ${start}-${end}/${total}` &&
    (length === null || length === String(size))
  if (!exact || reply.body === null) {
    // A 200 holds the whole file: it is cancelled unread.
    await reply.body?.cancel()
    return null
  }
  const bytes = await readExactly(reply.body, size)
  return bytes !== null && looksLikeMp4(bytes, start) ? bytes : null
}

export function s3ClipSource(env: Env): ClipSource {
  return {
    async getPiece(ref, range) {
      try {
        return await fetchPiece(ref.url, env, range)
      } catch {
        // A network failure's message may hold the address: nothing of it goes on.
        return null
      }
    },
  }
}
