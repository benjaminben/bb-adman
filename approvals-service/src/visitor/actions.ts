// The visitor routes' logic, with no HTML: each takes the request and gives a plain result that
// a page renders. The link always comes from the path's slug and its session, never a field.
import type { Parts } from '../app'
import type { LinkRow } from '../db/links'
import { listSignoffs, type SignoffRow } from '../db/signoffs'
import { listVariants, type VariantRow } from '../db/variants'
import { readForm } from './forms'
import { clearedCookie, endSession, readSession, startSession } from './session'
import { tryPassword } from './throttle'

export type GalleryResult =
  | { kind: 'password' }
  | {
      kind: 'gallery'
      link: LinkRow
      variants: VariantRow[]
      signoffs: SignoffRow[]
      now: number
      m: string | null
    }

// `refused`: the form checks failed (403). `failed`: wrong password, unknown slug or too many
// tries, one result for all three.
export type EnterResult =
  { kind: 'refused' } | { kind: 'failed' } | { kind: 'entered'; cookie: string; location: string }

export type LeaveResult = { kind: 'refused' } | { kind: 'left'; cookie: string; location: string }

export async function openGallery(
  db: D1Database,
  request: Request,
  slug: string,
  now: number,
): Promise<GalleryResult> {
  const { session } = await readSession(db, request, slug, now)
  if (session === null) return { kind: 'password' }
  const linkId = session.link.id
  const [variants, signoffs] = await Promise.all([
    listVariants(db, linkId),
    listSignoffs(db, linkId),
  ])
  const m = new URL(request.url).searchParams.get('m')
  return { kind: 'gallery', link: session.link, variants, signoffs, now, m }
}

export async function enterLink(
  db: D1Database,
  request: Request,
  slug: string,
  parts: Parts,
): Promise<EnterResult> {
  const fields = await readForm(request)
  if (fields === null) return { kind: 'refused' }
  const linkId = await tryPassword(db, slug, fields.get('password') ?? '', parts.now())
  if (linkId === null) return { kind: 'failed' }
  const cookie = await startSession(db, linkId, slug, parts)
  return { kind: 'entered', cookie, location: `/l/${slug}` }
}

export async function leaveLink(
  db: D1Database,
  request: Request,
  slug: string,
  now: number,
): Promise<LeaveResult> {
  const fields = await readForm(request)
  if (fields === null) return { kind: 'refused' }
  const { session } = await readSession(db, request, slug, now)
  if (session === null) return { kind: 'refused' }
  await endSession(db, session)
  return { kind: 'left', cookie: clearedCookie(slug), location: `/l/${slug}` }
}
