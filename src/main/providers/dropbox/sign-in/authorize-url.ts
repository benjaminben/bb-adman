// The address the browser opens for a Dropbox sign-in (spec/phases/phase-09.md "The sign-in
// redirect", authorize address). Built only from the pinned Dropbox host and constants in the
// code, never from a setting or a project value. It holds the challenge, never the verifier.
import { DROPBOX_APP_KEY } from '@/shared/config/public-ids'
import { DROPBOX_SIGN_IN_PORT } from '@/main/providers/dropbox/sign-in-port'

const AUTHORIZE_ADDRESS = 'https://www.dropbox.com/oauth2/authorize'
const SCOPES = 'files.content.write files.content.read files.metadata.read'

export const DROPBOX_REDIRECT_HOST = '127.0.0.1'
export const DROPBOX_REDIRECT_PATH = '/oauth/dropbox'
export const DROPBOX_REDIRECT_URI = `http://${DROPBOX_REDIRECT_HOST}:${DROPBOX_SIGN_IN_PORT}${DROPBOX_REDIRECT_PATH}`

export function authorizeUrl(values: { state: string; challenge: string }): string {
  const url = new URL(AUTHORIZE_ADDRESS)
  url.search = new URLSearchParams({
    client_id: DROPBOX_APP_KEY,
    response_type: 'code',
    redirect_uri: DROPBOX_REDIRECT_URI,
    state: values.state,
    code_challenge: values.challenge,
    code_challenge_method: 'S256',
    token_access_type: 'offline',
    scope: SCOPES,
  }).toString()
  return url.toString()
}
