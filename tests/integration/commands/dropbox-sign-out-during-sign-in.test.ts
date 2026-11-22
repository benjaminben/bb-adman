// P9-5b: sign-out refuses sign_in_in_progress while a sign-in waits or finishes, so it cannot
// clear the settings around a token that is being saved. The listener is replaced by one that
// waits until closed, so this file binds no port and may run beside the sign-in file. No
// browser opens and no request is made.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { makeFixture, type Fixture } from '../core-fixture'
import { createCommandBus } from '@/main/commands/bus'
import { storageDropboxSignIn } from '@/main/commands/storage/dropbox-sign-in'
import { cancelDropboxSignIn } from '@/main/providers/dropbox/sign-in/session'
import type { RedirectWait } from '@/main/providers/dropbox/sign-in/listener'

vi.mock('@/main/providers/dropbox/sign-in/listener', () => ({
  waitForRedirect: async (): Promise<RedirectWait> => {
    let end: (error: Error) => void = () => undefined
    const result = new Promise<never>((_resolve, reject) => {
      end = reject
    })
    return { port: 0, address: '127.0.0.1', result, close: () => end(new Error('closed')) }
  },
}))

let f: Fixture
afterEach(() => {
  cancelDropboxSignIn()
  f.cleanup()
})

describe('storage.dropboxSignOut during a sign-in [P9-5b]', () => {
  it('refuses sign_in_in_progress and keeps the token and settings', async () => {
    f = makeFixture()
    f.core.secrets.set('dropbox.refreshToken', 'made-up-saved-token')
    f.core.settings.setDropbox({ accountName: 'Ann Example', rootPath: 'Adman' })
    const opened: string[] = []
    const deps = { ...f.core.deps, openExternal: async (url: string) => void opened.push(url) }
    const bus = createCommandBus({
      handlers: [storageDropboxSignIn(deps)],
      projects: deps.projects,
      undo: deps.undo,
      log: deps.log,
      emit: () => undefined,
      askPermission: async () => false,
    })
    const signIn = bus.execute('storage.dropboxSignIn', {}, { actor: 'user' })
    await expect.poll(() => opened.length).toBe(1)
    expect(await f.user('storage.dropboxSignOut', {})).toEqual({
      ok: false,
      error: expect.objectContaining({ details: { reason: 'sign_in_in_progress' } }),
    })
    expect(f.core.secrets.get('dropbox.refreshToken')).toBe('made-up-saved-token')
    expect(f.core.settings.get().storage.dropbox).toEqual({
      accountName: 'Ann Example',
      rootPath: 'Adman',
    })
    cancelDropboxSignIn()
    expect(await signIn).toMatchObject({ ok: false })
    // Once the sign-in has ended, sign-out works again.
    expect(await f.user('storage.dropboxSignOut', {})).toEqual({ ok: true, data: null })
  })
})
