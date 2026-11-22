// The visitor routes' logic, with no page text: each gives a plain result that a reply or a page
// is built from. The link always comes from the path's slug and its session, never a field.
import type { Parts } from '../app'
import { Email, Slug } from '../contract'
import { checkPassword } from '../crypto/password'
import { listSignoffs } from '../db/signoffs'
import { listVariants } from '../db/variants'
import { readForm } from './forms'
import { noticeOn, type NoticeKey } from './notices'
import { clearedReviewerCookie, reviewerCookie, reviewerOf } from './reviewer'
import { clearedCookie, endSession, readSession, startSession } from './session'
import { tryPassword } from './throttle'
import type { Db } from '../db/client'

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
  // Only sign-offs whose version equals their variant's current version (R-10); none for a
  // variant no longer in the gallery.
  signoffs: { id: string; variantKey: string; version: number; email: string; createdAt: number }[]
  // The reviewer cookie's checked email, or null.
  reviewer: string | null
  notice: NoticeKey | null
}

export type Variant = GalleryView['variants'][number]
export type Signoff = GalleryView['signoffs'][number]

export type GalleryResult =
  { kind: 'password'; notice: NoticeKey | null } | { kind: 'gallery'; view: GalleryView }

// What a page has: the slug from its path, the Cookie header text and the `m` query value.
export type GalleryInput = { slug: string; cookie: string | null; m: string | null }

// `refused`: the form checks failed (403). `failed`: wrong password, unknown slug or too many
// tries, one result for all three.
export type EnterResult =
  { kind: 'refused' } | { kind: 'failed' } | { kind: 'entered'; cookie: string }

export type LeaveResult = { kind: 'refused' } | { kind: 'left'; cookies: string[] }

// `bad-email`: nothing is set and the page shows the notice.
export type ReviewerResult =
  { kind: 'refused' } | { kind: 'bad-email' } | { kind: 'saved'; cookie: string }

// A slug of the wrong shape is treated exactly like an unknown one.
const goodSlug = (slug: string) => Slug.safeParse(slug).success

export async function openGallery(
  db: Db,
  { slug, cookie, m }: GalleryInput,
  now: number,
): Promise<GalleryResult> {
  const password = { kind: 'password', notice: noticeOn('password', m) } as const
  if (!goodSlug(slug)) return password
  const { session } = await readSession(db, cookie, slug, now)
  if (session === null) return password
  const linkId = session.link.id
  const [variants, signoffs] = await Promise.all([
    listVariants(db, linkId),
    listSignoffs(db, linkId),
  ])
  // A variant's current version, by key: only sign-offs of exactly that version are shown.
  const current = new Map(variants.map((row) => [row.variantKey, row.version]))
  const view: GalleryView = {
    link: { slug: session.link.slug, campaignName: session.link.campaignName },
    variants: variants.map((row) => ({
      variantKey: row.variantKey,
      position: row.position,
      title: row.title,
      sizeLine: row.sizeLine,
      version: row.version,
      expired: row.pictureExpiresAt <= now,
    })),
    signoffs: signoffs
      .filter((row) => current.get(row.variantKey) === row.version)
      .map((row) => ({
        id: row.id,
        variantKey: row.variantKey,
        version: row.version,
        email: row.email,
        createdAt: row.createdAt,
      })),
    // Read only here, once the session is valid; the password page never reads it.
    reviewer: reviewerOf(cookie, slug),
    notice: noticeOn('gallery', m),
  }
  return { kind: 'gallery', view }
}

export async function enterLink(
  db: Db,
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
  return { kind: 'entered', cookie }
}

export async function leaveLink(
  db: Db,
  request: Request,
  slug: string,
  now: number,
): Promise<LeaveResult> {
  const fields = await readForm(request)
  if (fields === null) return { kind: 'refused' }
  if (!goodSlug(slug)) return { kind: 'refused' }
  const { session } = await readSession(db, request.headers.get('Cookie'), slug, now)
  if (session === null) return { kind: 'refused' }
  await endSession(db, session)
  return { kind: 'left', cookies: [clearedCookie(slug), clearedReviewerCookie(slug)] }
}

// "Use this email": checks 1 to 4, then the email. Writes nothing to the database.
export async function saveReviewer(
  db: Db,
  request: Request,
  slug: string,
  now: number,
): Promise<ReviewerResult> {
  const fields = await readForm(request)
  if (fields === null || !goodSlug(slug)) return { kind: 'refused' }
  const { session } = await readSession(db, request.headers.get('Cookie'), slug, now)
  if (session === null) return { kind: 'refused' }
  const email = Email.safeParse(fields.get('email') ?? '')
  if (!email.success) return { kind: 'bad-email' }
  return { kind: 'saved', cookie: reviewerCookie(slug, email.data) }
}
