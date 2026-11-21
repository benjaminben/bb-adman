// spec/approvals-service-visitor.md "Pictures", "The picture route": for a valid session only.
// Every check passes before the first byte is sent; any failure is the 404 with an empty body.
import type { Parts } from '../app'
import { findVariant } from '../db/variants'
import type { Env } from '../env'
import type { Picture } from '../pictures/source'
import { emptyNotFound, pictureHeaders } from './headers'
import { readSession } from './session'
import type { VisitorHandler } from './routes'

const PIECE = 1024 * 1024

// Hands the checked bytes over in 1 MiB pieces, so no whole-reply size limit applies.
function streamOf(bytes: Uint8Array): ReadableStream<Uint8Array> {
  let at = 0
  return new ReadableStream({
    pull(controller) {
      if (at >= bytes.byteLength) return controller.close()
      controller.enqueue(bytes.subarray(at, at + PIECE))
      at += PIECE
    },
  })
}

async function findPicture(
  request: Request,
  env: Env,
  parts: Parts,
  [slug = '', variantKey = '', version = '']: string[],
): Promise<Picture | null> {
  const now = parts.now()
  const { session } = await readSession(env.DB, request.headers.get('Cookie'), slug, now)
  if (session === null) return null
  const row = await findVariant(env.DB, session.link.id, variantKey)
  // Compared as text, so "03" is not version 3.
  if (row === null || String(row.version) !== version) return null
  if (row.pictureExpiresAt <= now || parts.pictures === undefined) return null
  try {
    return await parts.pictures.get({ url: row.pictureUrl })
  } catch {
    // A source's error may name the address; it is neither logged nor passed on.
    return null
  }
}

export const pictureRoute: VisitorHandler = async ({ request, env, parts, params }) => {
  const picture = await findPicture(request, env, parts, params)
  if (picture === null) return emptyNotFound(request)
  return new Response(streamOf(picture.bytes), {
    status: 200,
    headers: pictureHeaders(picture.type),
  })
}
