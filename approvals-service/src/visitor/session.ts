// spec/approvals-service.md "Session": one cookie per link, named for its slug. The table holds
// the SHA-256 of the token, never the token.
import type { Parts } from '../app'
import type { RandomBytes } from '../crypto/random'
import { clearTries } from '../db/enter'
import { findLinkBySlug, type LinkRow } from '../db/links'
import { addSession, deleteExpiredSessions, deleteSession, hasSession } from '../db/sessions'

export const SESSION_AGE = 12 * 60 * 60 * 1000

const ATTRIBUTES = 'Path=/; Max-Age=43200; HttpOnly; Secure; SameSite=Lax'
const TOKEN = /^[A-Za-z0-9_-]{43}$/
const TOKEN_BYTES = 32

export type Session = { link: LinkRow; tokenHash: string }

const cookieName = (slug: string) => `__Host-adman-${slug}`

export const sessionCookie = (slug: string, token: string) =>
  `${cookieName(slug)}=${token}; ${ATTRIBUTES}`

export const clearedCookie = (slug: string) =>
  `${cookieName(slug)}=; ${ATTRIBUTES.replace('Max-Age=43200', 'Max-Age=0')}`

// 32 random bytes, base64url without padding: 43 letters.
function newToken(random: RandomBytes): string {
  const text = btoa(String.fromCharCode(...random(TOKEN_BYTES)))
  return text.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

// The value of the cookie of exactly this link's name, when it has the token's shape.
function tokenOf(request: Request, slug: string): string | null {
  const name = cookieName(slug)
  for (const pair of (request.headers.get('Cookie') ?? '').split(';')) {
    const at = pair.indexOf('=')
    if (at < 0 || pair.slice(0, at).trim() !== name) continue
    const value = pair.slice(at + 1).trim()
    return TOKEN.test(value) ? value : null
  }
  return null
}

// The link of the slug, with the session when the request holds a live one for that link.
export async function readSession(
  db: D1Database,
  request: Request,
  slug: string,
  now: number,
): Promise<{ link: LinkRow | null; session: Session | null }> {
  const link = await findLinkBySlug(db, slug)
  if (link === null) return { link, session: null }
  const token = tokenOf(request, slug)
  if (token === null) return { link, session: null }
  const tokenHash = await hashToken(token)
  const live = await hasSession(db, tokenHash, link.id, now)
  return { link, session: live ? { link, tokenHash } : null }
}

// After a right password: the link's expired rows go, the new row is added and the try count
// starts again, in one batch. Gives the Set-Cookie text.
export async function startSession(
  db: D1Database,
  linkId: string,
  slug: string,
  parts: Parts,
): Promise<string> {
  const token = newToken(parts.random)
  const now = parts.now()
  await db.batch([
    deleteExpiredSessions(db, linkId, now),
    addSession(db, { tokenHash: await hashToken(token), linkId, expiresAt: now + SESSION_AGE }),
    clearTries(db, linkId),
  ])
  return sessionCookie(slug, token)
}

export async function endSession(db: D1Database, session: Session): Promise<void> {
  await deleteSession(db, session.tokenHash, session.link.id).run()
}
