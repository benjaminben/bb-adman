import 'server-only'
// The password try count (spec/approvals-service.md "Wrong-password limit"): one atomic
// statement counts the try and reads the stored hash, before the hash is computed.
import type { StoredPassword } from '../crypto/password'
import type { Db, Statement } from './client'

export type CountedTry = { linkId: string; tries: number; password: StoredPassword }

type TryRecord = {
  id: string
  tries: number
  password_hash: string
  password_salt: string
  password_iterations: number
}

// `windowStart` is now - 15 minutes. Null when the slug has no link.
export async function countPasswordTry(
  db: Db,
  slug: string,
  windowStart: number,
  now: number,
): Promise<CountedTry | null> {
  const record = await db
    .prepare(
      `UPDATE link SET
        tries       = CASE WHEN tries_since IS NULL OR tries_since <= ?1 THEN 1 ELSE tries + 1 END,
        tries_since = CASE WHEN tries_since IS NULL OR tries_since <= ?1 THEN ?2 ELSE tries_since END
      WHERE slug = ?3
      RETURNING id, tries, password_hash, password_salt, password_iterations`,
    )
    .bind(windowStart, now, slug)
    .first<TryRecord>()
  if (record === null) return null
  return {
    linkId: record.id,
    tries: record.tries,
    password: {
      hash: record.password_hash,
      salt: record.password_salt,
      iterations: record.password_iterations,
    },
  }
}

// A right password starts the count again, only while the link still holds that password.
export function clearTries(db: Db, linkId: string, checked: StoredPassword): Statement {
  return db
    .prepare(
      `UPDATE link SET tries = 0, tries_since = NULL
        WHERE id = ? AND password_salt = ? AND password_hash = ?`,
    )
    .bind(linkId, checked.salt, checked.hash)
}
