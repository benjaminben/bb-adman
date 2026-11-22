// The Dropbox token calls (spec/phases/phase-09.md "Dropbox hosts and calls", "The sign-in
// redirect"), each over the fetch it is given, which is the pinned fetch in the app. The token
// grants send `client_id` and never a secret: the sign-in uses PKCE. An access token goes only in
// the Authorization header. Every answer is read under the JSON limit and checked against a
// schema; fields Dropbox adds and the app does not use are dropped. Every failure is one
// ProviderFailure whose detail holds no token, code or verifier.
import { z } from 'zod'
import { DROPBOX_APP_KEY } from '@/shared/config/public-ids'
import { emptyAnswer, jsonAnswer } from './answer'
import { thrownFailure } from './failure'
import { DROPBOX_API_ORIGIN, DROPBOX_REDIRECT_URI } from './hosts'

export type CallOptions = { timeoutMs?: number }
export type CodeTokens = { refreshToken: string; accessToken: string; expiresInSeconds: number }
export type Access = { accessToken: string; expiresInSeconds: number }

const DEFAULT_TIMEOUT_MS = 30_000
const MAX_ACCOUNT_NAME = 100

// Visible ASCII only: a token goes into a header and is never split by a space.
const TOKEN_TEXT = /^[\x21-\x7e]+$/
const AccessGrant = z.object({
  access_token: z.string().min(1).max(4096).regex(TOKEN_TEXT),
  token_type: z.string().refine((type) => type.toLowerCase() === 'bearer'),
  expires_in: z.number().finite().positive().max(86_400),
})
const CodeGrant = AccessGrant.extend({
  refresh_token: z.string().min(1).max(1000).regex(TOKEN_TEXT),
})
const Account = z.object({ name: z.object({ display_name: z.string().max(10_000) }) })

async function guarded<T>(secrets: string[], call: () => Promise<T>): Promise<T> {
  try {
    return await call()
  } catch (error) {
    throw thrownFailure(error, secrets)
  }
}

function tokenRequest(fields: Record<string, string>, timeoutMs: number): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...fields, client_id: DROPBOX_APP_KEY }).toString(),
    signal: AbortSignal.timeout(timeoutMs),
  }
}

function bearerRequest(accessToken: string, timeoutMs: number): RequestInit {
  return {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(timeoutMs),
  }
}

// The authorization code from the redirect, for a refresh token and a first access token.
export function exchangeCode(
  input: { code: string; verifier: string },
  dropboxFetch: typeof fetch,
  { timeoutMs = DEFAULT_TIMEOUT_MS }: CallOptions = {},
): Promise<CodeTokens> {
  const secrets = [input.code, input.verifier]
  return guarded(secrets, async () => {
    const fields = {
      grant_type: 'authorization_code',
      code: input.code,
      redirect_uri: DROPBOX_REDIRECT_URI,
      code_verifier: input.verifier,
    }
    const response = await dropboxFetch(
      `${DROPBOX_API_ORIGIN}/oauth2/token`,
      tokenRequest(fields, timeoutMs),
    )
    const grant = await jsonAnswer(response, CodeGrant, secrets, 'token')
    secrets.push(grant.refresh_token, grant.access_token)
    return {
      refreshToken: grant.refresh_token,
      accessToken: grant.access_token,
      expiresInSeconds: grant.expires_in,
    }
  })
}

// A new access token. A revoked or unknown refresh token is bad_key, reason dropbox_signed_out.
export function renewAccess(
  refreshToken: string,
  dropboxFetch: typeof fetch,
  { timeoutMs = DEFAULT_TIMEOUT_MS }: CallOptions = {},
): Promise<Access> {
  const secrets = [refreshToken]
  return guarded(secrets, async () => {
    const fields = { grant_type: 'refresh_token', refresh_token: refreshToken }
    const response = await dropboxFetch(
      `${DROPBOX_API_ORIGIN}/oauth2/token`,
      tokenRequest(fields, timeoutMs),
    )
    const grant = await jsonAnswer(response, AccessGrant, secrets, 'token')
    return { accessToken: grant.access_token, expiresInSeconds: grant.expires_in }
  })
}

// Ends the access token and, with it, the refresh token it came from (Dropbox's rule).
export function revokeToken(
  accessToken: string,
  dropboxFetch: typeof fetch,
  { timeoutMs = DEFAULT_TIMEOUT_MS }: CallOptions = {},
): Promise<void> {
  const secrets = [accessToken]
  return guarded(secrets, async () => {
    const response = await dropboxFetch(
      `${DROPBOX_API_ORIGIN}/2/auth/token/revoke`,
      bearerRequest(accessToken, timeoutMs),
    )
    await emptyAnswer(response, secrets)
  })
}

// `name.display_name` with control and format characters removed, trimmed, at most 100 code
// points; '' when nothing is left. The email and account ID are not kept.
export function cleanAccountName(name: string): string {
  const plain = name.replace(/[\p{Cc}\p{Cf}\p{Cs}]/gu, '').trim()
  return [...plain].slice(0, MAX_ACCOUNT_NAME).join('').trimEnd()
}

export function currentAccountName(
  accessToken: string,
  dropboxFetch: typeof fetch,
  { timeoutMs = DEFAULT_TIMEOUT_MS }: CallOptions = {},
): Promise<string> {
  const secrets = [accessToken]
  return guarded(secrets, async () => {
    const response = await dropboxFetch(
      `${DROPBOX_API_ORIGIN}/2/users/get_current_account`,
      bearerRequest(accessToken, timeoutMs),
    )
    const account = await jsonAnswer(response, Account, secrets)
    return cleanAccountName(account.name.display_name)
  })
}
