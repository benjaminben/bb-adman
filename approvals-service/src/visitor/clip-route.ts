// round-2-approvals-video.md "The clip route (service)": one piece of a video's clip, for a valid
// session only. Every check passes before the first byte; any failure is the 404 with an empty
// body, and a 416 comes only after the session and the row have passed.
import type { Parts } from '../app'
import { findVariant } from '../db/variants'
import type { Env } from '../env'
import type { ClipSource } from '../pictures/clip-source'
import { clipHeaders, emptyNotFound, unsatisfiable } from './headers'
import { parseRange } from './range'
import { readSession } from './session'
import type { VisitorHandler } from './routes'
import { streamOf } from './stream-of'

type Clip = { url: string; total: number; source: ClipSource }

async function findClip(
  request: Request,
  env: Env,
  parts: Parts,
  [slug = '', variantKey = '', version = '']: string[],
): Promise<Clip | null> {
  const now = parts.now()
  const { session } = await readSession(env.DB, request.headers.get('Cookie'), slug, now)
  if (session === null) return null
  const row = await findVariant(env.DB, session.link.id, variantKey)
  // Compared as text, so "03" is not version 3.
  if (row === null || String(row.version) !== version || row.kind !== 'video') return null
  if (row.clipUrl === null || row.clipBytes === null) return null
  if (row.pictureExpiresAt <= now || parts.clips === undefined) return null
  return { url: row.clipUrl, total: row.clipBytes, source: parts.clips }
}

async function pieceOf(clip: Clip, start: number, end: number): Promise<Uint8Array | null> {
  try {
    return await clip.source.getPiece({ url: clip.url }, { start, end, total: clip.total })
  } catch {
    // A source's error may name the address; it is neither logged nor passed on.
    return null
  }
}

export const clipRoute: VisitorHandler = async ({ request, env, parts, params }) => {
  const clip = await findClip(request, env, parts, params)
  if (clip === null) return emptyNotFound(request)
  const range = parseRange(request.headers.get('Range'), clip.total)
  if (range.kind === 'bad') return emptyNotFound(request)
  if (range.kind === 'unsatisfiable') return unsatisfiable(request, clip.total)
  const bytes = await pieceOf(clip, range.start, range.end)
  if (bytes === null) return emptyNotFound(request)
  return new Response(streamOf(bytes), {
    status: 206,
    headers: clipHeaders(range.start, range.end, clip.total),
  })
}
