import { describe, it, expect } from 'vitest'
import {
  authorizeUrl,
  DROPBOX_REDIRECT_PATH,
  DROPBOX_REDIRECT_URI,
} from '@/main/providers/dropbox/sign-in/authorize-url'
import { DROPBOX_APP_KEY } from '@/shared/config/public-ids'

const STATE = 'made-up-state-value'
const CHALLENGE = 'made-up-challenge-value'

describe('authorizeUrl [phase-09 "The sign-in redirect", authorize address]', () => {
  const url = new URL(authorizeUrl({ state: STATE, challenge: CHALLENGE }))

  it('goes to https://www.dropbox.com/oauth2/authorize and nowhere else', () => {
    expect(url.protocol).toBe('https:')
    expect(url.host).toBe('www.dropbox.com')
    expect(url.pathname).toBe('/oauth2/authorize')
    expect(url.username + url.password + url.hash).toBe('')
  })

  it('carries exactly the query names and values the spec fixes', () => {
    expect([...url.searchParams.entries()]).toEqual([
      ['client_id', DROPBOX_APP_KEY],
      ['response_type', 'code'],
      ['redirect_uri', 'http://127.0.0.1:47822/oauth/dropbox'],
      ['state', STATE],
      ['code_challenge', CHALLENGE],
      ['code_challenge_method', 'S256'],
      ['token_access_type', 'offline'],
      ['scope', 'files.content.write files.content.read files.metadata.read'],
    ])
  })

  it('holds no secret and no verifier', () => {
    const text = url.toString()
    for (const word of ['secret', 'verifier', 'password']) expect(text).not.toContain(word)
  })

  it('builds the redirect address from the loopback address, the fixed port and path', () => {
    expect(DROPBOX_REDIRECT_PATH).toBe('/oauth/dropbox')
    expect(DROPBOX_REDIRECT_URI).toBe('http://127.0.0.1:47822/oauth/dropbox')
  })
})
