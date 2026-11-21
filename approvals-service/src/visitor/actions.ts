// The visitor routes' logic, with no HTML: each takes the request and gives a plain result that
// a page renders. The link always comes from the path's slug and its session, never a field.
import type { Parts } from '../app'
import { Slug } from '../contract'
import { checkPassword } from '../crypto/password'
import { listSignoffs } from '../db/signoffs'
import { listVariants } from '../db/variants'
import { readForm } from './forms'
import { clearedCookie, endSession, readSession, startSession } from './session'
import { tryPassword } from './throttle'

// Only what the gallery shows: no password, no link, project or campaign ID, no picture address.
export type GalleryView = {
  link: { slug: string; campaignName: string }
  variants: {
    variantKey: string
    position: number
    title: string
    sizeLine: string
    version: number
    expired: boolean
  }[]
  signoffs: { id: string; variantKey: string; version: number; email: string; createdAt: number }[]
  m: string | null
}

export type GalleryResult = { kind: 'password' } | ({ kind: 'gallery' } & GalleryView)

// `refused`: the form checks failed (403). `failed`: wrong password, unknown slug or too many
// tries, one result for all three.
export type EnterResult =
  { kind: 'refused' } | { kind: 'failed' } | { kind: 'entered'; cookie: string; location: string }

export type LeaveResult = { kind: 'refused' } | { kind: 'left'; cookie: string; location: string }

// A slug of the wrong shape is treated exactly like an unknown one.
const goodSlug = (slug: string) => Slug.safeParse(slug).success

export async function openGallery(
  db: D1Database,
  request: Request,
  slug: string,
  now: number,
): Promise<GalleryResult> {
  if (!goodSlug(slug)) return { kind: 'password' }
  const { session } = await readSession(db, request, slug, now)
  if (session === null) return { kind: 'password' }
  const linkId = session.link.id
  const [variants, signoffs] = await Promise.all([
    listVariants(db, linkId),
    listSignoffs(db, linkId),
  ])
  return {
    kind: 'gallery',
    link: { slug: session.link.slug, campaignName: session.link.campaignName },
    variants: variants.map((row) => ({
      variantKey: row.variantKey,
      position: row.position,
      title: row.title,
      sizeLine: row.sizeLine,
      version: row.version,
      expired: row.pictureExpiresAt <= now,
    })),
    signoffs: signoffs.map((row) => ({
      id: row.id,
      variantKey: row.variantKey,
      version: row.version,
      email: row.email,
      createdAt: row.createdAt,
    })),
    m: new URL(request.url).searchParams.get('m'),
  }
}

export async function enterLink(
  db: D1Database,
  request: Request,
  slug: string,
  parts: Parts,
): Promise<EnterResult> {
  const fields = await readForm(request)
  if (fields === null) return { kind: 'refused' }
  const password = fields.get('password') ?? ''
  if (!goodSlug(slug)) {
    // As for an unknown slug: the hash runs once, and the answer is no.
    await checkPassword(password, null)
    return { kind: 'failed' }
  }
  const checked = await tryPassword(db, slug, password, parts.now())
  if (checked === null) return { kind: 'failed' }
  const cookie = await startSession(db, checked, slug, parts)
  if (cookie === null) return { kind: 'failed' }
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
  if (!goodSlug(slug)) return { kind: 'refused' }
  const { session } = await readSession(db, request, slug, now)
  if (session === null) return { kind: 'refused' }
  await endSession(db, session)
  return { kind: 'left', cookie: clearedCookie(slug), location: `/l/${slug}` }
}
