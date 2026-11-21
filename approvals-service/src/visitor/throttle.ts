// spec/approvals-service.md "Wrong-password limit": at most 10 tries per link in 15 minutes,
// counted before the hash is computed.
import { checkPassword } from '../crypto/password'
import { countPasswordTry } from '../db/enter'

export const MAX_TRIES = 10
export const TRY_WINDOW = 15 * 60 * 1000

// The link's ID when the password is right and the try is within the limit; otherwise null.
// The caller gives one reply to every null, so the three failures cannot be told apart.
export async function tryPassword(
  db: D1Database,
  slug: string,
  password: string,
  now: number,
): Promise<string | null> {
  const counted = await countPasswordTry(db, slug, now - TRY_WINDOW, now)
  if (counted === null) {
    // An unknown slug runs the hash once too, so the time taken does not tell it apart.
    await checkPassword(password, null)
    return null
  }
  if (counted.tries > MAX_TRIES) return null
  return (await checkPassword(password, counted.password)) ? counted.linkId : null
}
