// The Dropbox addresses (spec/phases/phase-09.md "Dropbox hosts and calls"). The app's requests go
// only to the two API hosts, through pinned-fetch.ts. The browser alone goes to the authorize
// address, through openExternal, and Dropbox sends it back to the redirect address.
import { DROPBOX_SIGN_IN_PORT } from './sign-in-port'

export const DROPBOX_API_HOST = 'api.dropboxapi.com'
export const DROPBOX_CONTENT_HOST = 'content.dropboxapi.com'
export const DROPBOX_HOSTS: readonly string[] = [DROPBOX_API_HOST, DROPBOX_CONTENT_HOST]

export const DROPBOX_API_ORIGIN = `https://${DROPBOX_API_HOST}`
export const DROPBOX_CONTENT_ORIGIN = `https://${DROPBOX_CONTENT_HOST}`

export const DROPBOX_AUTHORIZE_URL = 'https://www.dropbox.com/oauth2/authorize'
export const DROPBOX_REDIRECT_URI = `http://127.0.0.1:${DROPBOX_SIGN_IN_PORT}/oauth/dropbox`
