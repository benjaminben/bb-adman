// P9-1 (spec/phases/phase-09.md "Dropbox tokens", A-211, A-213): the Dropbox refresh token is a
// sign-in secret. No window command can write or delete it, and settings.update cannot write
// storage.dropbox: only the Dropbox commands do.
import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, type Fixture } from '../core-fixture'
import { SECRET_NAMES, SIGN_IN_SECRET_NAMES, USER_SECRET_NAMES } from '@/shared/schemas/secrets'

let f: Fixture | undefined
afterEach(() => {
  f?.cleanup()
  f = undefined
})

const TOKEN = 'made-up-refresh-token-0042'
const invalid = { ok: false, error: { code: 'INVALID_INPUT' } }

describe('the sign-in secret names [P9-1, A-211]', () => {
  it('names the Dropbox refresh token as the one sign-in secret, outside the user keys', () => {
    expect(SIGN_IN_SECRET_NAMES).toEqual(['dropbox.refreshToken'])
    expect(SECRET_NAMES).toContain('dropbox.refreshToken')
    expect(USER_SECRET_NAMES).not.toContain('dropbox.refreshToken')
    expect(USER_SECRET_NAMES).not.toContain('mcp.token')
  })

  it('refuses secret.set for the refresh token and saves nothing', async () => {
    f = makeFixture()
    const result = await f.user('secret.set', { name: 'dropbox.refreshToken', value: TOKEN })
    expect(result).toMatchObject(invalid)
    expect(f.core.secrets.get('dropbox.refreshToken')).toBeUndefined()
    expect(JSON.stringify(result)).not.toContain(TOKEN)
    expect(f.readLogs()).not.toContain(TOKEN)
  })

  it('refuses secret.delete for the refresh token and leaves a saved one in place', async () => {
    f = makeFixture()
    f.core.secrets.set('dropbox.refreshToken', TOKEN)
    expect(await f.user('secret.delete', { name: 'dropbox.refreshToken' })).toMatchObject(invalid)
    expect(f.core.secrets.get('dropbox.refreshToken')).toBe(TOKEN)
  })
})

describe('settings.update and storage.dropbox [P9-1, A-213]', () => {
  it.each([
    [{ storage: { dropbox: { accountName: 'Sam', rootPath: 'Adman' } } }],
    [{ storage: { dropbox: null } }],
    [{ storage: { s3: null, dropbox: null } }],
  ])('refuses %j with INVALID_INPUT and changes nothing', async (patch) => {
    f = makeFixture()
    const before = f.core.settings.get()
    expect(await f.user('settings.update', patch)).toMatchObject(invalid)
    expect(f.core.settings.get()).toEqual(before)
  })

  it('still saves storage.s3', async () => {
    f = makeFixture()
    const s3 = { bucket: 'made-up-bucket', region: 'eu-west-1', prefix: '' }
    expect(await f.user('settings.update', { storage: { s3 } })).toMatchObject({ ok: true })
    expect(f.core.settings.get().storage).toEqual({ s3, dropbox: null })
  })
})
