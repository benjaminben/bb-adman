// spec/phases/round-2-approvals.md "Sign off all: one request for all" (R-11): one request signs
// exactly the set the page showed, or nothing. The link comes from the session, never a field.
import type { Parts } from '../app'
import { randomLetters } from '../crypto/random'
import { addSignoffsIfVariant } from '../db/signoffs'
import { listVariants } from '../db/variants'
import { galleryStamp, signableSet } from './stamp'
import type { Db } from '../db/client'

const SEEN = /^[0-9a-f]{64}$/

// `email` is the output of `Email`; `seen` is the stamp the page was drawn with.
export async function signOffAll(
  db: Db,
  linkId: string,
  seen: string | null,
  email: string,
  parts: Parts,
): Promise<'signed-all' | 'gallery-changed'> {
  const now = parts.now()
  // Steps 1 to 3: the set read now must be the set the page showed.
  const set = signableSet(await listVariants(db, linkId), now)
  if (seen === null || !SEEN.test(seen) || seen !== (await galleryStamp(set))) {
    return 'gallery-changed'
  }
  // Step 4: one transaction. Each statement still writes only while that variant has that
  // version for this link, and a repeat of the same email adds nothing. The set comes from the
  // gallery, which holds at most GALLERY_MAX variants.
  const rows = set.map((row) => ({
    id: randomLetters(24, parts.random),
    variantKey: row.variantKey,
    version: row.version,
    email,
    createdAt: now,
  }))
  if (rows.length > 0) await db.batch(addSignoffsIfVariant(db, linkId, rows))
  return 'signed-all'
}
