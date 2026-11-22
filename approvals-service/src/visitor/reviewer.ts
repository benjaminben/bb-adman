// spec/phases/round-2-approvals.md "How the email is kept and checked (R-11)": the reviewer's
// email, kept for the browser session in a cookie of its own per link. It grants nothing: every
// route still needs the session cookie. The value is never logged or put in an address.
import { Email } from '../contract'

// No Max-Age and no Expires, so the browser drops it when its session ends. No Domain.
const ATTRIBUTES = 'Path=/; HttpOnly; Secure; SameSite=Lax'

const cookieName = (slug: string) => `__Host-adman-${slug}-as`

// `email` is an already checked email (the output of `Email`).
export const reviewerCookie = (slug: string, email: string) =>
  `${cookieName(slug)}=${email}; ${ATTRIBUTES}`

export const clearedReviewerCookie = (slug: string) =>
  `${cookieName(slug)}=; ${ATTRIBUTES.replace('Path=/;', 'Path=/; Max-Age=0;')}`

// The value of the cookie of exactly this link's name, only when it is an email exactly as
// `Email` would give it (trimmed, lower case, ASCII); anything else is null.
export function reviewerOf(cookie: string | null, slug: string): string | null {
  const name = cookieName(slug)
  for (const pair of (cookie ?? '').split(';')) {
    const at = pair.indexOf('=')
    if (at < 0 || pair.slice(0, at).trim() !== name) continue
    const value = pair.slice(at + 1)
    const parsed = Email.safeParse(value)
    return parsed.success && parsed.data === value ? value : null
  }
  return null
}
