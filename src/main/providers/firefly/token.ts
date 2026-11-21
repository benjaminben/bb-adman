// P4-6: an OAuth server-to-server token from the client ID and secret, as Adobe's public
// Firefly documentation shows it: a form POST to the sign-in host. The request goes only to
// the sign-in host (pinnedFetch 'token'). A token is asked for once per run and not kept.
import { failureFromAnswer, failureFromError, fail } from './failure'
import { FIREFLY_TOKEN_ORIGIN, pinnedFetch } from './pinned-origin'

export const TOKEN_PATH = '/ims/token/v3'
export const FIREFLY_SCOPE =
  'openid,AdobeID,session,additional_info,read_organizations,firefly_api,ff_apis'

export type Credentials = { clientId: string; clientSecret: string }

export async function requestToken(
  transport: typeof fetch,
  credentials: Credentials,
  signal: AbortSignal,
): Promise<string> {
  const secrets = [credentials.clientId, credentials.clientSecret]
  try {
    const form = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      scope: FIREFLY_SCOPE,
    })
    const response = await pinnedFetch('token', transport)(`${FIREFLY_TOKEN_ORIGIN}${TOKEN_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      signal,
    })
    const text = await response.text()
    if (!response.ok) throw failureFromAnswer(response.status, text, secrets)
    const token = (JSON.parse(text) as { access_token?: unknown }).access_token
    if (typeof token !== 'string' || token === '') {
      throw fail('other', 'No token in the sign-in answer', secrets)
    }
    return token
  } catch (error) {
    throw failureFromError(error, signal.aborted, secrets)
  }
}
