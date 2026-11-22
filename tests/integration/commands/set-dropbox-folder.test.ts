// storage.setDropboxFolder (spec/phases/phase-09.md "Dropbox tokens", A-213): the one writer of
// settings.storage.dropbox.rootPath. Each part passes the storage path rules; refused while not
// signed in; agents are denied. Nothing here reaches Dropbox.
import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, type Fixture } from '../core-fixture'
import { denialMessage } from '@/main/commands/agent-policy'
import { isDropboxRootPath } from '@/main/providers/dropbox/root-path'

const REFRESH = 'made-up-refresh-token-for-folder-0001'

let f: Fixture
afterEach(() => f.cleanup())

function setUp(opts: { signedIn?: boolean; accountName?: string } = {}) {
  f = makeFixture()
  if (opts.signedIn !== false) f.core.secrets.set('dropbox.refreshToken', REFRESH)
  if (opts.accountName !== undefined) {
    f.core.settings.setDropbox({ accountName: opts.accountName, rootPath: 'Old' })
  }
}

const folderRefused = {
  ok: false,
  error: {
    code: 'INVALID_INPUT',
    message: 'That folder name cannot be used in Dropbox.',
    details: { reason: 'dropbox_folder_refused' },
  },
}

describe('storage.setDropboxFolder [A-213]', () => {
  it('saves the folder trimmed, keeps the account name, and sets changesAppState', async () => {
    setUp({ accountName: 'Ann Example' })
    const result = await f.user('storage.setDropboxFolder', { rootPath: '  Adman/Spring ads  ' })
    expect(result).toEqual({ ok: true, data: { rootPath: 'Adman/Spring ads' } })
    expect(f.core.settings.get().storage.dropbox).toEqual({
      accountName: 'Ann Example',
      rootPath: 'Adman/Spring ads',
    })
    expect(f.events.some((e) => e.name === 'app.stateChanged')).toBe(true)
  })

  it("accepts '' (the app folder itself)", async () => {
    setUp({ accountName: 'Ann Example' })
    expect(await f.user('storage.setDropboxFolder', { rootPath: '' })).toEqual({
      ok: true,
      data: { rootPath: '' },
    })
    expect(f.core.settings.get().storage.dropbox?.rootPath).toBe('')
  })

  it('saves an empty account name when signed in with no Dropbox settings', async () => {
    setUp()
    await f.user('storage.setDropboxFolder', { rootPath: 'Adman' })
    expect(f.core.settings.get().storage.dropbox).toEqual({ accountName: '', rootPath: 'Adman' })
  })

  it.each([
    ['..', '..'],
    ['a part ..', 'Adman/../Other'],
    ['a part .', 'Adman/./x'],
    ['a leading /', '/Adman'],
    ['a trailing /', 'Adman/'],
    ['an empty part', 'Adman//x'],
    ['a backslash', 'Adman\\x'],
    ['a NUL', 'Ad\u0000man'],
    ['a tab', 'Ad\tman'],
    ['a DEL', 'Ad\u007fman'],
    ['a C1 control', 'Ad\u0085man'],
    ['a line break', 'Ad\nman'],
    ['a colon', 'C:x'],
    ['a <', 'a<b'],
    ['a ?', 'what?'],
    ['a *', 'a*'],
    ['a "', 'a"b'],
    ['a |', 'a|b'],
    ['a part ending in a dot', 'Adman./x'],
    ['a part ending in a space', 'Adman /x'],
    ['a reserved name', 'CON'],
    ['a reserved name with an extension', 'Adman/nul.txt'],
  ])('refuses %s with INVALID_INPUT and saves nothing', async (_name, rootPath) => {
    setUp({ accountName: 'Ann Example' })
    const before = f.core.settings.get()
    expect(await f.user('storage.setDropboxFolder', { rootPath })).toEqual(folderRefused)
    expect(f.core.settings.get()).toEqual(before)
  })

  it('refuses a folder longer than 200 characters through its schema', async () => {
    setUp({ accountName: 'Ann Example' })
    const result = await f.user('storage.setDropboxFolder', { rootPath: 'a'.repeat(201) })
    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } })
    expect(f.core.settings.get().storage.dropbox?.rootPath).toBe('Old')
  })

  it('refuses dropbox_not_signed_in when no refresh token is saved', async () => {
    setUp({ signedIn: false })
    expect(await f.user('storage.setDropboxFolder', { rootPath: 'Adman' })).toEqual({
      ok: false,
      error: {
        code: 'RULE_VIOLATION',
        message: 'Sign in to Dropbox in Settings, then try again.',
        details: { reason: 'dropbox_not_signed_in' },
      },
    })
    expect(f.core.settings.get().storage.dropbox).toBeNull()
  })

  it('is AGENT_DENIED for an agent and changes nothing', async () => {
    setUp({ accountName: 'Ann Example' })
    expect(await f.agent('storage.setDropboxFolder', { rootPath: 'Agent' })).toEqual({
      ok: false,
      error: { code: 'AGENT_DENIED', message: denialMessage('storage.setDropboxFolder') },
    })
    expect(f.core.settings.get().storage.dropbox?.rootPath).toBe('Old')
  })
})

describe('isDropboxRootPath: the check a saved rootPath passes again before use', () => {
  it.each([
    ['', true],
    ['Adman', true],
    ['Adman/Spring ads', true],
    [' Adman', true],
    ['../x', false],
    ['x\u0007', false],
    ['/x', false],
    ['a'.repeat(201), false],
  ])('%j gives %s', (rootPath, expected) => {
    expect(isDropboxRootPath(rootPath)).toBe(expected)
  })
})
