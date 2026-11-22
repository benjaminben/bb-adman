// One Dropbox sign-in at a time (spec/phases/phase-09.md "The sign-in redirect"; security class
// full). Order: in progress, canStore(), listen, openExternal, wait, exchange, account, save the
// token, save the settings, revoke an old token (a failure after the exchange revokes the new
// one instead, P9-5b). The code and verifier go only to exchangeCode;
// the authorize address (it holds state and the challenge) goes only to openExternal. No log
// line, error or reply holds any of them, or a token: failures are logged by kind only.
import type { CoreDeps } from '@/main/core-deps'
import type { LogActor } from '@/main/log/activity-log'
import { ProviderFailure } from '@/main/providers/types'
import { INSECURE_MESSAGE } from '@/main/secrets/secret-store'
import { publishRefusal } from '@/shared/publish/messages'
import { AppError } from '@/shared/schemas/result'
import { accessTokenFor, forgetDropboxAccess } from '@/main/providers/dropbox/access-token'
import { currentAccountName, exchangeCode, revokeToken } from '@/main/providers/dropbox/oauth'
import { isDropboxRootPath } from '@/main/providers/dropbox/root-path'
import { DROPBOX_SIGN_IN_PORT } from '@/main/providers/dropbox/sign-in-port'
import { authorizeUrl } from './authorize-url'
import { waitForRedirect, type RedirectWait } from './listener'
import { makePkce } from './pkce'

export type SignInDeps = Pick<
  CoreDeps,
  'secrets' | 'settings' | 'openExternal' | 'dropboxFetch' | 'log'
>
export type SignInOptions = { timeoutMs?: number }
type Step = { name: string; actor: LogActor; commandId: string }

const SIGN_IN_TIMEOUT_MS = 5 * 60 * 1000
const REFRESH = 'dropbox.refreshToken'

let waiting: RedirectWait | null = null
let busy = false

// App quit (index.ts, before-quit): the listener closes, and the sign-in ends sign_in_failed.
export function cancelDropboxSignIn(): void {
  waiting?.close()
}

// P9-5b: true from the start of a sign-in until it has finished, so sign-out can refuse.
export function dropboxSignInBusy(): boolean {
  return busy
}

function logFailure(deps: Pick<CoreDeps, 'log'>, step: Step, error: unknown): void {
  const kind = error instanceof ProviderFailure ? error.error.kind : 'other'
  deps.log.write({
    level: 'warn',
    event: 'provider',
    name: step.name,
    actor: step.actor,
    ok: false,
    errorKind: kind,
    message: 'A Dropbox call failed.',
    context: { commandId: step.commandId, provider: 'dropbox' },
  })
}

// Best effort: a failure is logged by kind and the caller goes on.
export async function revokeQuietly(
  deps: Pick<CoreDeps, 'dropboxFetch' | 'log'>,
  refreshToken: string,
  step: Step,
): Promise<void> {
  try {
    const accessToken = await accessTokenFor(refreshToken, deps.dropboxFetch)
    await revokeToken(accessToken, deps.dropboxFetch)
  } catch (error) {
    logFailure(deps, step, error)
  }
}

// Revoking an access token also revokes the refresh token it came with.
async function revokeAccessQuietly(deps: SignInDeps, accessToken: string, step: Step) {
  try {
    await revokeToken(accessToken, deps.dropboxFetch)
  } catch (error) {
    logFailure(deps, step, error)
  }
}

async function codeFromBrowser(deps: SignInDeps, timeoutMs: number) {
  const { verifier, challenge, state } = makePkce()
  const wait = await waitForRedirect({ port: DROPBOX_SIGN_IN_PORT, state, timeoutMs })
  waiting = wait
  // Handled now, so a time-out or close() before the await below is never unhandled.
  const result = wait.result.then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  )
  try {
    await deps.openExternal(authorizeUrl({ state, challenge }))
  } catch {
    wait.close()
    throw publishRefusal('sign_in_failed')
  }
  const answer = await result
  if ('error' in answer) throw answer.error
  if ('refused' in answer.value) throw publishRefusal('sign_in_refused')
  if ('failed' in answer.value) throw publishRefusal('sign_in_failed')
  return { code: answer.value.code, verifier }
}

// A Dropbox call that failed is logged by kind and becomes sign_in_failed.
async function orFailed<T>(deps: SignInDeps, step: Step, call: () => Promise<T>): Promise<T> {
  try {
    return await call()
  } catch (error) {
    logFailure(deps, step, error)
    throw publishRefusal('sign_in_failed')
  }
}

// The account, then the token, then the settings.
async function save(deps: SignInDeps, refreshToken: string, accessToken: string, step: Step) {
  const accountName = await orFailed(deps, step, () =>
    currentAccountName(accessToken, deps.dropboxFetch),
  )
  const old = deps.secrets.get(REFRESH)
  deps.secrets.set(REFRESH, refreshToken)
  const kept = deps.settings.get().storage.dropbox?.rootPath ?? ''
  deps.settings.setDropbox({ accountName, rootPath: isDropboxRootPath(kept) ? kept : '' })
  return { accountName, old }
}

async function signIn(deps: SignInDeps, timeoutMs: number, step: Step) {
  if (!deps.secrets.canStore()) {
    throw new AppError('RULE_VIOLATION', INSECURE_MESSAGE, {
      reason: 'secure_storage_unavailable',
    })
  }
  const { code, verifier } = await codeFromBrowser(deps, timeoutMs)
  const tokens = await orFailed(deps, step, () =>
    exchangeCode({ code, verifier }, deps.dropboxFetch),
  )
  let saved: { accountName: string; old: string | undefined }
  try {
    saved = await save(deps, tokens.refreshToken, tokens.accessToken, step)
  } catch (error) {
    // P9-5b: the new token is revoked, quietly; the refusal the user sees stays the same.
    await revokeAccessQuietly(deps, tokens.accessToken, step)
    throw error
  }
  if (saved.old !== undefined && saved.old !== tokens.refreshToken) {
    await revokeQuietly(deps, saved.old, step)
    forgetDropboxAccess(saved.old)
  }
  return { accountName: saved.accountName }
}

export async function signInToDropbox(
  deps: SignInDeps,
  step: Step,
  { timeoutMs = SIGN_IN_TIMEOUT_MS }: SignInOptions = {},
): Promise<{ accountName: string }> {
  if (busy) throw publishRefusal('sign_in_in_progress')
  busy = true
  try {
    return await signIn(deps, timeoutMs, step)
  } finally {
    waiting?.close()
    waiting = null
    busy = false
  }
}
