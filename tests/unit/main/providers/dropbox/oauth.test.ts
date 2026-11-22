import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { failureOf } from '../../../../helpers/failure-of'
import {
  standInFetch,
  startDropboxStandIn,
  type DropboxStandIn,
} from '../../../../helpers/dropbox-stand-in'
import { DROPBOX_APP_KEY } from '@/shared/config/public-ids'
import { DROPBOX_REDIRECT_URI } from '@/main/providers/dropbox/hosts'
import {
  currentAccountName,
  exchangeCode,
  renewAccess,
  revokeToken,
} from '@/main/providers/dropbox/oauth'

const VERIFIER = 'v'.repeat(86)
let standIn: DropboxStandIn
let dropboxFetch: typeof fetch
const logs: unknown[][] = []

beforeAll(async () => {
  standIn = await startDropboxStandIn()
  dropboxFetch = standInFetch(standIn)
})
afterAll(() => standIn.close())
beforeEach(() => {
  standIn.seen.length = 0
  standIn.accountName = 'Ann Example'
  for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => void logs.push(args))
  }
})
afterEach(() => {
  vi.restoreAllMocks()
  expect(logs).toEqual([])
})

const form = (i: number) => new URLSearchParams(standIn.seen[i]?.body.toString())
const formOf = (i: number) => Object.fromEntries(form(i))

async function signedIn() {
  const code = standIn.issueCode()
  return exchangeCode({ code, verifier: VERIFIER }, dropboxFetch)
}

describe('the token calls [P9-2, phase-09 "Dropbox hosts and calls"]', () => {
  it('exchanges a code with exactly the PKCE form fields and no secret', async () => {
    const code = standIn.issueCode()
    const tokens = await exchangeCode({ code, verifier: VERIFIER }, dropboxFetch)
    expect(tokens.refreshToken).toMatch(/^stand-in-refresh-/)
    expect(tokens.accessToken).toMatch(/^sl\.stand-in-access-/)
    expect(tokens.expiresInSeconds).toBe(14_400)
    const [seen] = standIn.seen
    expect(seen).toMatchObject({
      host: 'api.dropboxapi.com',
      method: 'POST',
      path: '/oauth2/token',
    })
    expect(seen?.headers['content-type']).toBe('application/x-www-form-urlencoded')
    expect(seen?.headers.authorization).toBeUndefined()
    expect(formOf(0)).toEqual({
      grant_type: 'authorization_code',
      code,
      client_id: DROPBOX_APP_KEY,
      redirect_uri: DROPBOX_REDIRECT_URI,
      code_verifier: VERIFIER,
    })
  })

  it('renews with exactly the refresh form fields and no secret', async () => {
    const refresh = standIn.plantRefreshToken()
    const renewed = await renewAccess(refresh, dropboxFetch)
    expect(standIn.refreshFor(renewed.accessToken)).toBe(refresh)
    expect(renewed.expiresInSeconds).toBe(14_400)
    expect(standIn.seen[0]?.headers.authorization).toBeUndefined()
    expect(formOf(0)).toEqual({
      grant_type: 'refresh_token',
      refresh_token: refresh,
      client_id: DROPBOX_APP_KEY,
    })
  })

  it('a renewal Dropbox answers invalid_grant ends signed out, holding no token', async () => {
    const refresh = standIn.plantRefreshToken()
    const { accessToken } = await renewAccess(refresh, dropboxFetch)
    await revokeToken(accessToken, dropboxFetch)
    expect(standIn.isRevoked(refresh)).toBe(true)
    const error = await renewAccess(refresh, dropboxFetch).catch((e: unknown) => e)
    const failure = await failureOf(Promise.reject(error))
    expect(failure).toEqual({
      kind: 'bad_key',
      reason: 'dropbox_signed_out',
      detail: '400 invalid_grant',
    })
    const text = `${String(error)} ${(error as Error).stack ?? ''} ${JSON.stringify(failure)}`
    expect(text).not.toContain(refresh)
    expect(text).not.toContain(accessToken)
  })

  it.each([
    ['refresh_token missing', { access_token: 'sl.a', token_type: 'bearer', expires_in: 14400 }],
    [
      'token_type not bearer',
      { access_token: 'sl.a', token_type: 'mac', expires_in: 14400, refresh_token: 'r' },
    ],
    [
      'refresh_token over 1,000 characters',
      {
        access_token: 'sl.a',
        token_type: 'bearer',
        expires_in: 1,
        refresh_token: 'r'.repeat(1001),
      },
    ],
    [
      'refresh_token with a space',
      { access_token: 'sl.a', token_type: 'bearer', expires_in: 1, refresh_token: 'r r' },
    ],
    ['access_token missing', { token_type: 'bearer', expires_in: 14400, refresh_token: 'r' }],
    [
      'expires_in not a number',
      { access_token: 'sl.a', token_type: 'bearer', expires_in: '14400', refresh_token: 'r' },
    ],
    ['not JSON', 'refresh_token=r'],
  ])('refuses a code reply with %s', async (_name, body) => {
    const reply =
      typeof body === 'string' ? { status: 200, text: body } : { status: 200, json: body }
    standIn.once('token', reply)
    const failure = await failureOf(signedIn())
    expect(failure).toEqual({ kind: 'other', detail: 'Dropbox sent an answer Adman cannot read' })
  })

  it('accepts a reply with Bearer in capitals and fields it does not use', async () => {
    const body = {
      access_token: 'sl.a',
      token_type: 'Bearer',
      expires_in: 60,
      refresh_token: 'r',
      uid: '1',
    }
    standIn.once('token', { status: 200, json: body })
    expect(await signedIn()).toEqual({
      refreshToken: 'r',
      accessToken: 'sl.a',
      expiresInSeconds: 60,
    })
  })

  it.each([
    ['with its length given', { oversized: 1024 * 1024 + 1 }],
    ['sent in chunks', { oversized: 1024 * 1024 + 1, chunked: true as const }],
  ])('refuses an answer over 1 MiB %s', async (_name, once) => {
    standIn.once('token', once)
    expect(await failureOf(signedIn())).toEqual({ kind: 'other', detail: 'Answer too large' })
  })

  it('a slow answer is timeout', async () => {
    standIn.once('token', { slowMs: 500 })
    const run = exchangeCode({ code: standIn.issueCode(), verifier: VERIFIER }, dropboxFetch, {
      timeoutMs: 50,
    })
    expect((await failureOf(run)).kind).toBe('timeout')
  })

  it('a redirect is not followed', async () => {
    standIn.once('token', { redirect: `${standIn.origin}/oauth2/token` })
    const failure = await failureOf(signedIn())
    expect(failure.kind).toBe('other')
    expect(standIn.seen).toHaveLength(1)
  })
})

describe('revoke and the account name [P9-2]', () => {
  it('sends the access token in the Authorization header only, to the API host', async () => {
    const { accessToken } = await signedIn()
    standIn.seen.length = 0
    expect(await currentAccountName(accessToken, dropboxFetch)).toBe('Ann Example')
    await revokeToken(accessToken, dropboxFetch)
    expect(standIn.seen.map((s) => [s.host, s.path])).toEqual([
      ['api.dropboxapi.com', '/2/users/get_current_account'],
      ['api.dropboxapi.com', '/2/auth/token/revoke'],
    ])
    for (const seen of standIn.seen) {
      expect(seen.headers.authorization).toBe(`Bearer ${accessToken}`)
      const elsewhere = { ...seen.headers, authorization: '' }
      expect(`${seen.path} ${seen.body.toString()} ${JSON.stringify(elsewhere)}`).not.toContain(
        accessToken,
      )
    }
  })

  it('a rejected access token is bad_key', async () => {
    expect((await failureOf(currentAccountName('sl.unknown', dropboxFetch))).kind).toBe('bad_key')
    expect((await failureOf(revokeToken('sl.unknown', dropboxFetch))).kind).toBe('bad_key')
  })

  it.each([
    ['a plain name', 'Ann Example', 'Ann Example'],
    ['control characters', 'Ann\u0000 Ex\u0007ample\n', 'Ann Example'],
    ['format characters', '‮Ann​ Example⁦', 'Ann Example'],
    ['spaces around it', '   Ann Example  ', 'Ann Example'],
    ['150 code points', '\u{1F600}'.repeat(150), '\u{1F600}'.repeat(100)],
    ['nothing left', '\u0001​  ', ''],
    ['an empty name', '', ''],
  ])('cleans an account name with %s', async (_name, given, expected) => {
    const { accessToken } = await signedIn()
    standIn.accountName = given
    expect(await currentAccountName(accessToken, dropboxFetch)).toBe(expected)
  })

  it('refuses an account answer with no display name', async () => {
    const { accessToken } = await signedIn()
    standIn.once('account', { status: 200, json: { name: {} } })
    expect((await failureOf(currentAccountName(accessToken, dropboxFetch))).kind).toBe('other')
  })
})

describe('nothing from the environment [P9-2, spec/providers.md "Rules for every adapter"]', () => {
  const saved = { ...process.env }
  afterEach(() => {
    process.env = { ...saved }
  })

  it('sends the calls to the pinned host with the app key on record, whatever is set', async () => {
    Object.assign(process.env, {
      DROPBOX_APP_KEY: 'environment-app-key',
      DROPBOX_APP_SECRET: 'environment-app-secret',
      DROPBOX_ACCESS_TOKEN: 'environment-access-token',
      HTTPS_PROXY: 'http://proxy-environment.example:8080',
      https_proxy: 'http://proxy-environment.example:8080',
      ALL_PROXY: 'http://proxy-environment.example:8080',
      NODE_USE_ENV_PROXY: '1',
    })
    const { accessToken } = await signedIn()
    await currentAccountName(accessToken, dropboxFetch)
    expect(standIn.seen.map((s) => s.host)).toEqual(['api.dropboxapi.com', 'api.dropboxapi.com'])
    expect(formOf(0).client_id).toBe(DROPBOX_APP_KEY)
    const sent = JSON.stringify(standIn.seen.map((s) => [s.headers, s.body.toString()]))
    expect(sent).not.toMatch(/environment-/)
  })
})
