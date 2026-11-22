// P9-6, from the security review of the sign-in commands: a failed settings save puts the old
// token back, and a sign-in refuses while a sign-out runs. The listener and the Dropbox calls
// are replaced by test functions, so this file binds no port, opens no browser and makes no
// request. Every token here is made up.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { makeFixture, type Fixture } from '../core-fixture'
import { createCommandBus } from '@/main/commands/bus'
import { storageDropboxSignIn } from '@/main/commands/storage/dropbox-sign-in'
import type { SignInDeps } from '@/main/providers/dropbox/sign-in/session'
import { cancelDropboxSignIn } from '@/main/providers/dropbox/sign-in/session'
import { forgetDropboxAccess } from '@/main/providers/dropbox/access-token'
import type { RedirectWait } from '@/main/providers/dropbox/sign-in/listener'

const calls = vi.hoisted(() => ({ renewGate: null as Promise<void> | null }))

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
    if (calls.renewGate !== null) await calls.renewGate
    return { accessToken: 'made-up-old-access', expiresInSeconds: 14400 }
  },
  revokeToken: async () => undefined,
  currentAccountName: async () => 'Ann Example',
  cleanAccountName: (name: string) => name,
}))

let f: Fixture
afterEach(() => {
  calls.renewGate = null
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

function failingSettings(): SignInDeps['settings'] {
  const real = f.core.deps.settings
  return {
    ...real,
    setDropbox: () => {
      throw new Error('disk full')
    },
  }
}

describe('storage.dropboxSignIn when the settings cannot be saved [P9-6]', () => {
  it.each([
    ['puts the old token back', 'made-up-old-token'],
    ['deletes the new token when there was none', undefined],
  ])('%s', async (_name, old) => {
    f = makeFixture()
    if (old !== undefined) f.core.secrets.set('dropbox.refreshToken', old)
    const deps = { ...f.core.deps, settings: failingSettings(), openExternal: async () => {} }
    expect(await signInWith(deps)).toMatchObject({ ok: false })
    expect(f.core.secrets.get('dropbox.refreshToken')).toBe(old)
    expect(f.core.settings.get().storage.dropbox).toBeNull()
  })
})

describe('storage.dropboxSignIn while a sign-out runs [P9-6]', () => {
  it('refuses sign_in_in_progress and changes nothing', async () => {
    f = makeFixture()
    f.core.secrets.set('dropbox.refreshToken', 'made-up-old-token')
    f.core.settings.setDropbox({ accountName: 'Ann Example', rootPath: 'Adman' })
    let release: () => void = () => undefined
    calls.renewGate = new Promise((resolve) => {
      release = resolve
    })
    const signOut = f.user('storage.dropboxSignOut', {})
    await new Promise((resolve) => setTimeout(resolve, 0))
    let opened = 0
    const deps = { ...f.core.deps, openExternal: async () => void (opened += 1) }
    expect(await signInWith(deps)).toEqual({
      ok: false,
      error: expect.objectContaining({ details: { reason: 'sign_in_in_progress' } }),
    })
    expect(opened).toBe(0)
    expect(f.core.secrets.get('dropbox.refreshToken')).toBe('made-up-old-token')
    release()
    expect(await signOut).toEqual({ ok: true, data: null })
    // Once the sign-out has ended, a sign-in works again.
    expect(await signInWith(deps)).toEqual({ ok: true, data: { accountName: 'Ann Example' } })
  })
})
