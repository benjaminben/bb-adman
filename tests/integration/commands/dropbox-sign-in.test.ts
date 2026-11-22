// storage.dropboxSignIn (spec/phases/phase-09.md "The sign-in redirect"; security class full).
// The listener runs on the real port 47822, so this file runs alone. openExternal is a test
// function: it reads `state` from the address and calls the listener as the browser would. The
// token host is the stand-in, through the pinned fetch. No browser opens; nothing leaves.
import net from 'node:net'
import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { makeFixture, fakeCrypto, type Fixture } from '../core-fixture'
import { createCommandBus, type BusEvent } from '@/main/commands/bus'
import { storageDropboxSignIn } from '@/main/commands/storage/dropbox-sign-in'
import { denialMessage } from '@/main/commands/agent-policy'
import { forgetDropboxAccess } from '@/main/providers/dropbox/access-token'
import { DROPBOX_SIGN_IN_PORT } from '@/main/providers/dropbox/sign-in-port'
import { cancelDropboxSignIn } from '@/main/providers/dropbox/sign-in/session'
import { connectError } from '../mcp/http-client'
import {
  startDropboxStandIn,
  standInFetch,
  type DropboxStandIn,
} from '../../helpers/dropbox-stand-in'

const PORT = DROPBOX_SIGN_IN_PORT
const REDIRECT = `http://127.0.0.1:${PORT}/oauth/dropbox`

let f: Fixture
let standIn: DropboxStandIn
beforeEach(async () => {
  standIn = await startDropboxStandIn()
  forgetDropboxAccess()
})
afterEach(async () => {
  cancelDropboxSignIn()
  forgetDropboxAccess()
  f.cleanup()
  await standIn.close()
})

// What the browser was given and what it sent, for the secrets check.
type Browser = { opened: string[]; sent: string[] }
type Answer = 'code' | 'deny' | 'neither' | 'nothing' | 'throw'

function browser(answer: Answer): Browser & { open: (url: string) => Promise<void> } {
  const b: Browser = { opened: [], sent: [] }
  const open = async (url: string) => {
    b.opened.push(url)
    if (answer === 'throw') throw new Error(`no browser for ${url}`)
    if (answer === 'nothing') return
    const query = new URL(url).searchParams
    const state = query.get('state') ?? ''
    const values: Record<string, string> = { state }
    if (answer === 'code') values.code = standIn.issueCode(query.get('code_challenge') ?? '')
    if (answer === 'deny') values.error = 'access_denied'
    b.sent.push(...Object.values(values))
    // Not awaited: the browser loads the page while openExternal has already returned.
    void fetch(`${REDIRECT}?${new URLSearchParams(values)}`)
      .then((r) => r.text())
      .catch(() => undefined)
  }
  return { ...b, open }
}

function signInBus(open: (url: string) => Promise<void>, timeoutMs?: number) {
  const events: BusEvent[] = []
  const deps = { ...f.core.deps, openExternal: open, dropboxFetch: standInFetch(standIn) }
  const bus = createCommandBus({
    handlers: [storageDropboxSignIn(deps, { timeoutMs })],
    projects: deps.projects,
    undo: deps.undo,
    log: deps.log,
    emit: (event) => events.push(event),
    askPermission: async () => false,
  })
  const run = (actor: 'user' | 'agent' = 'user') =>
    bus.execute('storage.dropboxSignIn', {}, { actor })
  return { run, events }
}

// Every value a sign-in holds that must appear nowhere: state, code, verifier and tokens.
function secretsOf(b: Browser): string[] {
  const values = [...b.sent]
  for (const seen of standIn.seen) {
    const form = new URLSearchParams(seen.body.toString())
    for (const name of ['code', 'code_verifier', 'refresh_token']) {
      const value = form.get(name)
      if (value) values.push(value)
    }
    const bearer = /^Bearer (\S+)$/.exec(seen.headers.authorization ?? '')?.[1]
    if (bearer) values.push(bearer, standIn.refreshFor(bearer) ?? '')
  }
  const saved = f.core.secrets.get('dropbox.refreshToken')
  if (saved) values.push(saved, ...standIn.accessTokensOf(saved))
  return values.filter((v) => v.length >= 8)
}

function expectNoSecretIn(b: Browser, ...outputs: unknown[]): void {
  const text = JSON.stringify(outputs) + f.readLogs()
  for (const secret of secretsOf(b)) expect(text).not.toContain(secret)
}

const refusal = (reason: string, code = 'RULE_VIOLATION') => ({
  ok: false,
  error: expect.objectContaining({ code, details: { reason } }),
})

describe('storage.dropboxSignIn: success', () => {
  it('saves the token and the settings, replies { accountName } only, and sets changesAppState', async () => {
    f = makeFixture()
    const b = browser('code')
    const { run, events } = signInBus(b.open)
    const reply = await run()
    expect(reply).toEqual({ ok: true, data: { accountName: 'Ann Example' } })
    expect(b.opened).toHaveLength(1)
    expect(new URL(b.opened[0] ?? '').origin).toBe('https://www.dropbox.com')
    const saved = f.core.secrets.get('dropbox.refreshToken') ?? ''
    expect(saved).toMatch(/^stand-in-refresh-/)
    expect(standIn.isRevoked(saved)).toBe(false)
    expect(f.core.settings.get().storage.dropbox).toEqual({
      accountName: 'Ann Example',
      rootPath: '',
    })
    expect(events).toEqual([{ name: 'app.stateChanged', payload: {} }])
    expect(await connectError('127.0.0.1', PORT)).toBe('ECONNREFUSED')
    // state, code, verifier, refresh token and access token were all collected.
    expect(new Set(secretsOf(b)).size).toBeGreaterThanOrEqual(5)
    expectNoSecretIn(b, reply, events)
  })

  it('keeps an old rootPath, and drops a saved one that fails the folder check', async () => {
    f = makeFixture()
    f.core.settings.setDropbox({ accountName: 'Old Name', rootPath: 'Adman/Ads' })
    await signInBus(browser('code').open).run()
    expect(f.core.settings.get().storage.dropbox).toEqual({
      accountName: 'Ann Example',
      rootPath: 'Adman/Ads',
    })
    f.core.settings.setDropbox({ accountName: 'Old Name', rootPath: '../outside' })
    await signInBus(browser('code').open).run()
    expect(f.core.settings.get().storage.dropbox?.rootPath).toBe('')
  })

  it('revokes the old token after the new one is saved', async () => {
    f = makeFixture()
    const old = standIn.plantRefreshToken()
    f.core.secrets.set('dropbox.refreshToken', old)
    const b = browser('code')
    expect(await signInBus(b.open).run()).toMatchObject({ ok: true })
    const saved = f.core.secrets.get('dropbox.refreshToken')
    expect(saved).not.toBe(old)
    expect(standIn.isRevoked(old)).toBe(true)
    expect(standIn.isRevoked(saved ?? '')).toBe(false)
    expectNoSecretIn(b)
  })

  it('still signs in when revoking the old token fails', async () => {
    f = makeFixture()
    f.core.secrets.set('dropbox.refreshToken', 'made-up-old-token-not-known')
    expect(await signInBus(browser('code').open).run()).toMatchObject({ ok: true })
    expect(f.core.secrets.get('dropbox.refreshToken')).toMatch(/^stand-in-refresh-/)
  })
})

describe('storage.dropboxSignIn: refusals, in order, with nothing saved', () => {
  function expectNothingSaved(): void {
    expect(f.core.secrets.get('dropbox.refreshToken')).toBeUndefined()
    expect(f.core.settings.get().storage.dropbox).toBeNull()
  }

  it('refuses sign_in_in_progress while one waits, without opening the browser again', async () => {
    f = makeFixture()
    const b = browser('nothing')
    const { run } = signInBus(b.open)
    const first = run()
    await expect.poll(() => b.opened.length).toBe(1)
    expect(await run()).toEqual(refusal('sign_in_in_progress'))
    expect(b.opened).toHaveLength(1)
    cancelDropboxSignIn()
    expect(await first).toEqual(refusal('sign_in_failed', 'PROVIDER_ERROR'))
    expect(await connectError('127.0.0.1', PORT)).toBe('ECONNREFUSED')
    expectNothingSaved()
  })

  it('refuses when secure storage is not available, before it listens or opens', async () => {
    f = makeFixture({ crypto: fakeCrypto(false) })
    const b = browser('code')
    expect(await signInBus(b.open).run()).toEqual({
      ok: false,
      error: {
        code: 'RULE_VIOLATION',
        message: 'This computer cannot store keys securely.',
        details: { reason: 'secure_storage_unavailable' },
      },
    })
    expect(b.opened).toEqual([])
    expect(standIn.seen).toEqual([])
    expectNothingSaved()
  })

  it('refuses sign_in_port_busy and opens no browser when the port is taken', async () => {
    f = makeFixture()
    const taken = net.createServer()
    await new Promise<void>((resolve) => taken.listen(PORT, '127.0.0.1', resolve))
    try {
      const b = browser('code')
      const reply = await signInBus(b.open).run()
      expect(reply).toEqual(refusal('sign_in_port_busy'))
      expect(b.opened).toEqual([])
    } finally {
      await new Promise((resolve) => taken.close(resolve))
    }
    expectNothingSaved()
  })

  it.each([
    ['openExternal fails', 'throw', 'sign_in_failed', 'PROVIDER_ERROR'],
    ['the browser cancels', 'deny', 'sign_in_refused', 'RULE_VIOLATION'],
    ['the answer has neither a code nor an error', 'neither', 'sign_in_failed', 'PROVIDER_ERROR'],
  ] as const)('when %s: %s, and the port is freed', async (_n, answer, reason, code) => {
    f = makeFixture()
    const b = browser(answer)
    const reply = await signInBus(b.open).run()
    expect(reply).toEqual(refusal(reason, code))
    expect(JSON.stringify(reply)).not.toContain('dropbox.com')
    expect(await connectError('127.0.0.1', PORT)).toBe('ECONNREFUSED')
    expect(standIn.seen).toEqual([])
    expectNothingSaved()
    expectNoSecretIn(b, reply)
  })

  it('refuses sign_in_timed_out when no answer comes in time', async () => {
    f = makeFixture()
    const b = browser('nothing')
    expect(await signInBus(b.open, 50).run()).toEqual(refusal('sign_in_timed_out'))
    expect(await connectError('127.0.0.1', PORT)).toBe('ECONNREFUSED')
    expectNothingSaved()
  })

  it.each([
    ['the token exchange is refused', 'token', { oauthError: 'invalid_grant' }],
    ['the token answer has no refresh token', 'token', { status: 200, json: { a: 1 } }],
    ['the account call fails', 'account', { status: 500, text: 'down' }],
  ] as const)('when %s: sign_in_failed, logged by kind only', async (_n, route, once) => {
    f = makeFixture()
    standIn.once(route, once)
    const b = browser('code')
    const { run, events } = signInBus(b.open)
    const reply = await run()
    expect(reply).toEqual({
      ok: false,
      error: {
        code: 'PROVIDER_ERROR',
        message: 'Dropbox did not finish the sign-in. Try again.',
        details: { reason: 'sign_in_failed' },
      },
    })
    expectNothingSaved()
    expect(f.readLogs()).toContain('"provider":"dropbox"')
    expectNoSecretIn(b, reply, events)
  })
})

describe('storage.dropboxSignIn: agents', () => {
  it('is AGENT_DENIED, opens nothing and listens on nothing', async () => {
    f = makeFixture()
    const b = browser('code')
    expect(await signInBus(b.open).run('agent')).toEqual({
      ok: false,
      error: { code: 'AGENT_DENIED', message: denialMessage('storage.dropboxSignIn') },
    })
    expect(b.opened).toEqual([])
    expect(await connectError('127.0.0.1', PORT)).toBe('ECONNREFUSED')
  })
})
