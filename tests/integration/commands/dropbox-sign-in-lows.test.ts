// Review leftovers, "Dropbox sign-in": a failed token restore does not hide the first failure;
// a second sign-out refuses while one runs; a sign-in refused during a
// sign-out says so. The listener and the Dropbox calls are test functions: no port, no browser,
// no request. Every token here is made up.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { makeFixture, type Fixture } from '../core-fixture'
import { createCommandBus } from '@/main/commands/bus'
import { storageDropboxSignIn } from '@/main/commands/storage/dropbox-sign-in'
import type { SignInDeps } from '@/main/providers/dropbox/sign-in/session'
import { cancelDropboxSignIn } from '@/main/providers/dropbox/sign-in/session'
import { forgetDropboxAccess } from '@/main/providers/dropbox/access-token'
import type { RedirectWait } from '@/main/providers/dropbox/sign-in/listener'
import { SIGN_IN_DURING_SIGN_OUT } from '@/shared/publish/messages'

const calls = vi.hoisted(() => ({ renewGates: [] as Promise<void>[] }))

vi.mock('@/main/providers/dropbox/sign-in/listener', () => ({
  waitForRedirect: async (): Promise<RedirectWait> => ({
    port: 0,
    address: '127.0.0.1',
    result: Promise.resolve({ code: 'made-up-code' }),
    close: () => undefined,
  }),
}))

vi.mock('@/main/providers/dropbox/oauth', () => ({
  exchangeCode: async () => ({
    refreshToken: 'made-up-new-token',
    accessToken: 'made-up-new-access',
    expiresInSeconds: 14400,
  }),
  renewAccess: async () => {
    const gate = calls.renewGates.shift()
    if (gate !== undefined) await gate
    return { accessToken: 'made-up-old-access', expiresInSeconds: 14400 }
  },
  revokeToken: async () => undefined,
  currentAccountName: async () => 'Ann Example',
  cleanAccountName: (name: string) => name,
}))

let f: Fixture
afterEach(() => {
  calls.renewGates = []
  cancelDropboxSignIn()
  forgetDropboxAccess()
  f.cleanup()
})

function signInWith(deps: SignInDeps) {
  const bus = createCommandBus({
    handlers: [storageDropboxSignIn(deps)],
    projects: f.core.deps.projects,
    undo: f.core.deps.undo,
    log: f.core.deps.log,
    emit: () => undefined,
    askPermission: async () => false,
  })
  return bus.execute('storage.dropboxSignIn', {}, { actor: 'user' })
}

function gate(): () => void {
  let release: () => void = () => undefined
  calls.renewGates.push(
    new Promise((resolve) => {
      release = resolve
    }),
  )
  return () => release()
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))
const refusedDuringSignOut = {
  ok: false,
  error: expect.objectContaining({
    message: SIGN_IN_DURING_SIGN_OUT,
    details: { reason: 'sign_in_in_progress' },
  }),
}

describe('storage.dropboxSignIn: a token restore that fails [P9-6 review, L1]', () => {
  it('logs the restore by kind and lets the settings failure through', async () => {
    f = makeFixture()
    f.core.secrets.set('dropbox.refreshToken', 'made-up-old-token')
    const real = f.core.deps.secrets
    const secrets: SignInDeps['secrets'] = {
      ...real,
      set: (name, value) => {
        if (value === 'made-up-old-token') throw new Error('keys file locked')
        real.set(name, value)
      },
    }
    const settings: SignInDeps['settings'] = {
      ...f.core.deps.settings,
      setDropbox: () => {
        throw new Error('disk full')
      },
    }
    const deps = { ...f.core.deps, secrets, settings, openExternal: async () => {} }
    expect(await signInWith(deps)).toMatchObject({ ok: false, error: { code: 'INTERNAL' } })
    const logs = f.readLogs()
    expect(logs).toContain('disk full')
    expect(logs).not.toContain('keys file locked')
    expect(logs).toContain('The saved Dropbox token could not be put back.')
  })
})

describe('storage.dropboxSignOut while one runs [P9-6 review, L2]', () => {
  it('refuses a second sign-out, and a sign-in with its own sentence, until it ends', async () => {
    f = makeFixture()
    f.core.secrets.set('dropbox.refreshToken', 'made-up-old-token')
    f.core.settings.setDropbox({ accountName: 'Ann Example', rootPath: 'Adman' })
    const release = gate()
    const first = f.user('storage.dropboxSignOut', {})
    await tick()
    expect(await f.user('storage.dropboxSignOut', {})).toEqual({
      ok: false,
      error: expect.objectContaining({
        message: 'Adman is already signing out of Dropbox.',
        details: { reason: 'sign_out_in_progress' },
      }),
    })
    const deps = { ...f.core.deps, openExternal: async () => {} }
    expect(await signInWith(deps)).toEqual(refusedDuringSignOut)
    release()
    expect(await first).toEqual({ ok: true, data: null })
    expect(f.core.secrets.get('dropbox.refreshToken')).toBeUndefined()
    expect(await signInWith(deps)).toEqual({ ok: true, data: { accountName: 'Ann Example' } })
  })
})
