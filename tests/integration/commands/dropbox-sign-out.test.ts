// storage.dropboxSignOut (spec/phases/phase-09.md "The sign-in redirect", A-215): revoke at
// Dropbox (best effort), forget the access token, delete the refresh token, clear the settings.
// Every Dropbox call goes to the stand-in through the pinned fetch; offline still signs out.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { makeFixture, fakeCrypto, type Fixture } from '../core-fixture'
import { createCommandBus, type BusEvent } from '@/main/commands/bus'
import {
  storageDropboxSignOut,
  SIGN_OUT_UNREADABLE_MESSAGE,
} from '@/main/commands/storage/dropbox-sign-out'
import { INSECURE_MESSAGE } from '@/main/secrets/secret-store'
import { denialMessage } from '@/main/commands/agent-policy'
import { accessTokenFor, forgetDropboxAccess } from '@/main/providers/dropbox/access-token'
import type { DropboxFetch } from '@/main/providers/dropbox/fetch'
import { pinnedFetch } from '@/main/providers/dropbox/pinned-fetch'
import {
  startDropboxStandIn,
  standInFetch,
  type DropboxStandIn,
} from '../../helpers/dropbox-stand-in'

let f: Fixture
let standIn: DropboxStandIn
beforeEach(async () => {
  f = makeFixture()
  standIn = await startDropboxStandIn()
  forgetDropboxAccess()
})
afterEach(async () => {
  forgetDropboxAccess()
  f.cleanup()
  await standIn.close()
})

// A fetch that never reaches a host: the pin passes, then the network is down.
const offlineFetch: DropboxFetch = pinnedFetch(() =>
  Promise.reject(Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } })),
)

function signOutBus(dropboxFetch: DropboxFetch) {
  const events: BusEvent[] = []
  const deps = { ...f.core.deps, dropboxFetch }
  const bus = createCommandBus({
    handlers: [storageDropboxSignOut(deps)],
    projects: deps.projects,
    undo: deps.undo,
    log: deps.log,
    emit: (event) => events.push(event),
    askPermission: async () => false,
  })
  const run = (actor: 'user' | 'agent' = 'user') =>
    bus.execute('storage.dropboxSignOut', {}, { actor })
  return { run, events }
}

function signIn(): string {
  const refresh = standIn.plantRefreshToken()
  f.core.secrets.set('dropbox.refreshToken', refresh)
  f.core.settings.setDropbox({ accountName: 'Ann Example', rootPath: 'Adman' })
  return refresh
}

const tokenCalls = () => standIn.seen.filter((s) => s.route === 'token').length

describe('storage.dropboxSignOut [A-215]', () => {
  it('revokes the token at Dropbox, deletes it, clears the settings, and sets changesAppState', async () => {
    const refresh = signIn()
    const { run, events } = signOutBus(standInFetch(standIn))
    expect(await run()).toEqual({ ok: true, data: null })
    expect(standIn.isRevoked(refresh)).toBe(true)
    const revoke = standIn.seen.find((s) => s.route === 'revoke')
    expect(revoke?.headers.authorization).toMatch(/^Bearer sl\.stand-in-access-/)
    expect(f.core.secrets.get('dropbox.refreshToken')).toBeUndefined()
    expect(f.core.secrets.summaries()).toEqual([])
    expect(f.core.settings.get().storage.dropbox).toBeNull()
    expect(events).toEqual([{ name: 'app.stateChanged', payload: {} }])
  })

  it('forgets the access token held in memory', async () => {
    const refresh = signIn()
    await accessTokenFor(refresh, standInFetch(standIn))
    const before = tokenCalls()
    await signOutBus(offlineFetch).run()
    const again = standIn.plantRefreshToken()
    await accessTokenFor(again, standInFetch(standIn))
    // A held token would have been reused; with it forgotten the old one must be renewed.
    await expect(accessTokenFor(refresh, standInFetch(standIn))).resolves.toMatch(/^sl\./)
    expect(tokenCalls()).toBe(before + 2)
  })

  it('signs out locally when offline, logging the failure by its kind only', async () => {
    const refresh = signIn()
    expect(await signOutBus(offlineFetch).run()).toEqual({ ok: true, data: null })
    expect(f.core.secrets.get('dropbox.refreshToken')).toBeUndefined()
    expect(f.core.settings.get().storage.dropbox).toBeNull()
    const logs = f.readLogs()
    expect(logs).toContain('offline')
    expect(logs).not.toContain(refresh)
  })

  it('signs out locally when Dropbox refuses the revoke', async () => {
    const refresh = signIn()
    standIn.once('revoke', { status: 500, text: `boom ${refresh}` })
    expect(await signOutBus(standInFetch(standIn)).run()).toEqual({ ok: true, data: null })
    expect(f.core.secrets.get('dropbox.refreshToken')).toBeUndefined()
    expect(f.core.settings.get().storage.dropbox).toBeNull()
    expect(f.readLogs()).not.toContain(refresh)
  })

  it('clears the settings and sends nothing when no token is saved', async () => {
    f.core.settings.setDropbox({ accountName: 'Ann Example', rootPath: 'Adman' })
    expect(await signOutBus(standInFetch(standIn)).run()).toEqual({ ok: true, data: null })
    expect(standIn.seen).toEqual([])
    expect(f.core.settings.get().storage.dropbox).toBeNull()
  })

  it('is AGENT_DENIED for an agent and changes nothing', async () => {
    const refresh = signIn()
    expect(await f.agent('storage.dropboxSignOut', {})).toEqual({
      ok: false,
      error: { code: 'AGENT_DENIED', message: denialMessage('storage.dropboxSignOut') },
    })
    expect(f.core.secrets.get('dropbox.refreshToken')).toBe(refresh)
    expect(f.core.settings.get().storage.dropbox).not.toBeNull()
    expect(standIn.seen).toEqual([])
  })
})

// P9-5b: sign-out never says done while the token may still be on disk.
describe('storage.dropboxSignOut when the token cannot be read [P9-5b]', () => {
  function expectStillSignedIn(refresh: string): void {
    expect(f.core.settings.get().storage.dropbox).toEqual({
      accountName: 'Ann Example',
      rootPath: 'Adman',
    })
    expect(standIn.seen).toEqual([])
    f.restart({ crypto: fakeCrypto() })
    expect(f.core.secrets.get('dropbox.refreshToken')).toBe(refresh)
  }

  it('refuses while secure storage is not available, and keeps the token and settings', async () => {
    const refresh = signIn()
    f.restart({ crypto: fakeCrypto(false) })
    expect(await signOutBus(standInFetch(standIn)).run()).toEqual({
      ok: false,
      error: {
        code: 'RULE_VIOLATION',
        message: INSECURE_MESSAGE,
        details: { reason: 'secure_storage_unavailable' },
      },
    })
    expectStillSignedIn(refresh)
  })

  it('refuses when the saved keys file cannot be read, and changes nothing', async () => {
    const refresh = signIn()
    const file = path.join(f.userData, 'secrets.bin')
    const saved = fs.readFileSync(file)
    fs.writeFileSync(file, 'not a key file')
    const reply = await signOutBus(standInFetch(standIn)).run()
    expect(reply).toEqual({
      ok: false,
      error: {
        code: 'RULE_VIOLATION',
        message: SIGN_OUT_UNREADABLE_MESSAGE,
        details: { reason: 'secrets_unreadable' },
      },
    })
    expect(fs.readFileSync(file, 'utf8')).toBe('not a key file')
    fs.writeFileSync(file, saved)
    expectStillSignedIn(refresh)
  })
})
