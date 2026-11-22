// The Dropbox access token, in main-process memory only (spec/phases/phase-09.md "Dropbox tokens",
// A-210). Kept per refresh token, under a SHA-256 of it, so the map holds no refresh token. It is
// reused until 5 minutes before it ends, then renewed; the caller forgets it after a 401 so the
// next call renews. It is never written to disk and forgotten at sign-out. Calls at the same time
// share one renewal. A failed renewal keeps nothing for that refresh token and touches no other.
import { createHash } from 'node:crypto'
import { renewAccess } from './oauth'

const RENEW_BEFORE_MS = 5 * 60 * 1000

type Held = { accessToken: string; endsAt: number }
const held = new Map<string, Held>()
const renewing = new Map<string, Promise<Held>>()

const keyOf = (refreshToken: string) => createHash('sha256').update(refreshToken).digest('hex')

async function renew(key: string, refreshToken: string, dropboxFetch: typeof fetch, now: number) {
  const promise = renewAccess(refreshToken, dropboxFetch).then(
    ({ accessToken, expiresInSeconds }) => ({ accessToken, endsAt: now + expiresInSeconds * 1000 }),
  )
  renewing.set(key, promise)
  try {
    const fresh = await promise
    if (renewing.get(key) === promise) held.set(key, fresh)
    return fresh
  } finally {
    if (renewing.get(key) === promise) renewing.delete(key)
  }
}

export async function accessTokenFor(
  refreshToken: string,
  dropboxFetch: typeof fetch,
  now: () => number = Date.now,
): Promise<string> {
  const key = keyOf(refreshToken)
  const current = held.get(key)
  if (current && now() < current.endsAt - RENEW_BEFORE_MS) return current.accessToken
  const pending = renewing.get(key)
  if (pending) return (await pending).accessToken
  held.delete(key)
  return (await renew(key, refreshToken, dropboxFetch, now())).accessToken
}

// One refresh token's access token (after a 401), or every one (at sign-out).
export function forgetDropboxAccess(refreshToken?: string): void {
  if (refreshToken === undefined) {
    held.clear()
    renewing.clear()
    return
  }
  const key = keyOf(refreshToken)
  held.delete(key)
  renewing.delete(key)
}
