// P9-15: the `accessToken` option, which only tests/live/dropbox.live.test.ts passes. With it the
// adapter sends that token, never reads a refresh token and never asks the token address; a 401
// is not renewed. The app's own adapters (index.ts) never pass it.
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { failureOf } from '../../../../helpers/failure-of'
import { standInFetch } from '../../../../helpers/dropbox-stand-in'
import { dropboxStorage } from '@/main/providers/dropbox/dropbox-storage'
import type { AdapterContext } from '@/main/providers/types'
import { defaultSettings } from '@/main/settings/defaults'
import { bytes, refresh, routes, standIn, storage, setUpDropboxStorage } from './storage-harness'

setUpDropboxStorage()

// A context with no secret at all: any read of one fails the test.
function noSecretContext(): AdapterContext {
  const settings = defaultSettings('/documents')
  settings.storage.dropbox = { accountName: 'Ann Example', rootPath: 'adman-live-test' }
  return {
    secret: () => {
      throw new Error('a secret was read')
    },
    settings: () => settings,
    model: () => '',
  }
}

// An access token the stand-in gave out, got the usual way first.
async function givenToken(): Promise<string> {
  await storage().exists('warm-up.txt')
  const [token] = standIn.accessTokensOf(refresh)
  standIn.seen.length = 0
  return token!
}

describe('Dropbox storage with a fixed access token [P9-15, live test only]', () => {
  it('uploads, lists and removes with the given token and no token request', async () => {
    const accessToken = await givenToken()
    const fixed = dropboxStorage(noSecretContext(), {
      fetch: standInFetch(standIn),
      timeoutMs: 200,
      accessToken,
    })
    await fixed.write('hello.txt', bytes(5), 'text/plain')
    expect(await fixed.list('')).toEqual(['hello.txt'])
    await fixed.remove(['hello.txt'])
    expect(await fixed.exists('hello.txt')).toBe(false)
    expect(routes()).not.toContain('token')
    const sent = standIn.seen.map((s) => s.headers.authorization)
    expect(new Set(sent)).toEqual(new Set([`Bearer ${accessToken}`]))
  })

  it('does not renew after a 401: the failure is bad_key and holds no token', async () => {
    const accessToken = await givenToken()
    const fixed = dropboxStorage(noSecretContext(), {
      fetch: standInFetch(standIn),
      timeoutMs: 200,
      accessToken,
    })
    standIn.once('files/get_metadata', { status: 401, json: { error: 'expired_access_token' } })
    const failure = await failureOf(fixed.exists('hello.txt'))
    expect(failure.kind).toBe('bad_key')
    expect(JSON.stringify(failure)).not.toContain(accessToken)
    expect(routes()).toEqual(['files/get_metadata'])
  })

  it('is never passed by the app: the adapters file names no access token', () => {
    const text = fs.readFileSync(path.resolve('src/main/providers/dropbox/index.ts'), 'utf8')
    expect(text).not.toContain('accessToken')
    expect(text).not.toContain('process.env')
  })
})
