// spec/approvals-service-visitor.md "Forms that write": Sign off and Remove. The link always comes
// from the path's slug and its session, never from a field.
import type { Parts } from '../app'
import { Email, Slug, VariantKey, Version } from '../contract'
import { randomLetters } from '../crypto/random'
import { addSignoffIfVariant, hasSignoff, removeSignoffOf } from '../db/signoffs'
import { readForm } from './forms'
import type { NoticeKey } from './notices'
import { readSession, type Session } from './session'
import type { Db } from '../db/client'

// `refused`: the form checks or the session failed (403). Otherwise the notice for the 303, and
// the variant to go back to when it has the checked shape.
export type SignoffResult =
  { kind: 'refused' } | { kind: 'done'; m: NoticeKey; variant?: string }

const VERSION_TEXT = /^[0-9]{1,16}$/

// Checks 1 to 4 of "Forms that write": the fields and the session, or null for the 403.
async function checkedForm(
  db: Db,
  request: Request,
  slug: string,
  now: number,
): Promise<{ fields: URLSearchParams; session: Session } | null> {
  const fields = await readForm(request)
  if (fields === null || !Slug.safeParse(slug).success) return null
  const { session } = await readSession(db, request.headers.get('Cookie'), slug, now)
  return session === null ? null : { fields, session }
}

function versionOf(text: string): number | null {
  if (!VERSION_TEXT.test(text)) return null
  const parsed = Version.safeParse(Number(text))
  return parsed.success ? parsed.data : null
}

export async function signOff(
  db: Db,
  request: Request,
  slug: string,
  parts: Parts,
): Promise<SignoffResult> {
  const checked = await checkedForm(db, request, slug, parts.now())
  if (checked === null) return { kind: 'refused' }
  const { fields, session } = checked
  const variantKey = VariantKey.safeParse(fields.get('variant') ?? '')
  // A key of the wrong shape cannot be in the gallery; it is never put in the address.
  if (!variantKey.success) return { kind: 'done', m: 'changed' }
  const variant = variantKey.data
  const version = versionOf(fields.get('version') ?? '')
  if (version === null) return { kind: 'done', m: 'changed', variant }
  const email = Email.safeParse(fields.get('email') ?? '')
  if (!email.success) return { kind: 'done', m: 'bad-email', variant }
  const linkId = session.link.id
  const row = {
    id: randomLetters(24, parts.random),
    variantKey: variant,
    version,
    email: email.data,
    createdAt: parts.now(),
  }
  const { meta } = await addSignoffIfVariant(db, linkId, row).run()
  if (meta.changes === 1 || (await hasSignoff(db, linkId, row))) {
    return { kind: 'done', m: 'signed', variant }
  }
  return { kind: 'done', m: 'changed', variant }
}

// Anyone with the link may remove any of its sign-offs [D-095]; an ID of another link removes
// nothing. `m=removed` either way.
export async function removeSignoff(
  db: Db,
  request: Request,
  slug: string,
  id: string,
  now: number,
): Promise<SignoffResult> {
  const checked = await checkedForm(db, request, slug, now)
  if (checked === null) return { kind: 'refused' }
  const variantKey = await removeSignoffOf(db, checked.session.link.id, id)
  const variant = VariantKey.safeParse(variantKey)
  return variant.success
    ? { kind: 'done', m: 'removed', variant: variant.data }
    : { kind: 'done', m: 'removed' }
}
