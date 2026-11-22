import { describe, expect, it } from 'vitest'
import { failureOf } from '../../../../helpers/failure-of'
import { standInFetch, type Once } from '../../../../helpers/dropbox-stand-in'
import { pinnedFetch } from '@/main/providers/dropbox/pinned-fetch'
import type { StorageProvider } from '@/main/providers/types'
import {
  bytes,
  MiB,
  refresh,
  routes,
  standIn,
  storage,
  streamOf,
  setUpDropboxStorage,
} from './storage-harness'

setUpDropboxStorage()

// Every token the stand-in gave for this refresh token, and the refresh token itself.
const tokens = () => [refresh, ...standIn.accessTokensOf(refresh)]
const PATH = 'secret-folder/private-name.txt'

describe('Dropbox storage failures [P9-3, phase-09 "Error kinds"]', () => {
  const seed = () => storage().write(PATH, bytes(4), 'text/plain')
  const read = () => storage().read(PATH)
  const exists = () => storage().exists(PATH)
  const write = () => storage().write(PATH, bytes(4), 'text/plain')
  const list = () => storage().list('secret-folder')
  const remove = () => storage().remove([PATH])
  const tag = (chain: string, status?: number): Once => ({ tag: chain, status })
  it.each<[string, string, Once, () => Promise<unknown>, string, string]>([
    ['403', 'files/download', { status: 403, json: {} }, read, 'bad_key', '403'],
    [
      'missing_scope',
      'files/get_metadata',
      tag('missing_scope'),
      exists,
      'bad_key',
      '409 missing_scope',
    ],
    ['429', 'files/upload', tag('too_many_requests', 429), write, 'quota', '429 too_many_requests'],
    [
      'too_many_write_operations',
      'files/delete_v2',
      tag('too_many_write_operations'),
      remove,
      'quota',
      '409 too_many_write_operations',
    ],
    ['503', 'files/list_folder', { status: 503, text: 'busy' }, list, 'quota', '503'],
    [
      'insufficient_space',
      'files/upload',
      tag('path/insufficient_space'),
      write,
      'other',
      '409 path/insufficient_space',
    ],
    ['a 500', 'files/get_metadata', { status: 500, text: PATH }, exists, 'other', '500'],
    [
      'a slow answer',
      'files/download',
      { slowMs: 600 },
      read,
      'timeout',
      'Dropbox did not answer in time',
    ],
  ])('%s is %s', async (_name, route, once, call, kind, detail) => {
    await seed()
    standIn.once(route, once)
    const error = await call().catch((e: unknown) => e)
    expect(await failureOf(Promise.reject(error))).toEqual({ kind, detail })
    const text = `${String(error)} ${(error as Error).stack} ${JSON.stringify(error)}`
    for (const secret of [PATH, 'secret-folder', 'private-name', ...tokens()])
      expect(text).not.toContain(secret)
  })

  it('a network that cannot be reached is offline', async () => {
    const down = pinnedFetch(() => Promise.reject(new TypeError(`fetch failed ${refresh}`)))
    const failure = await failureOf(storage('Root', down).exists(PATH))
    expect(failure).toEqual({ kind: 'offline', detail: 'Could not reach Dropbox' })
  })

  it('a revoked refresh token is bad_key, reason dropbox_signed_out', async () => {
    standIn.once('token', { oauthError: 'invalid_grant' })
    const failure = await failureOf(storage().exists(PATH))
    expect(failure).toEqual({
      kind: 'bad_key',
      reason: 'dropbox_signed_out',
      detail: '400 invalid_grant',
    })
  })
})

describe('a 401 [P9-3]', () => {
  const unauthorised = { status: 401, json: { error: { '.tag': 'invalid_access_token' } } }

  it('renews the access token once and sends the request again once', async () => {
    await storage().write(PATH, bytes(4), 'text/plain')
    const before = standIn.seen.length
    standIn.once('files/get_metadata', unauthorised)
    expect(await storage().exists(PATH)).toBe(true)
    const after = standIn.seen.slice(before)
    expect(after.map((s) => s.route)).toEqual(['files/get_metadata', 'token', 'files/get_metadata'])
    expect(after[0]?.headers.authorization).not.toBe(after[2]?.headers.authorization)
  })

  it('a second 401 is bad_key, after exactly one renewal', async () => {
    let calls = 0
    const always401: typeof fetch = (input, init) => {
      if (!String(input).endsWith('/2/files/get_metadata'))
        return standInFetch(standIn)(input, init)
      calls += 1
      return Promise.resolve(Response.json(unauthorised.json, { status: 401 }))
    }
    const failure = await failureOf(storage('Root', pinnedFetch(always401)).exists(PATH))
    expect(failure).toEqual({ kind: 'bad_key', detail: '401 invalid_access_token' })
    expect(calls).toBe(2)
    expect(routes().filter((r) => r === 'token')).toHaveLength(2)
  })

  it('in the middle of an upload session resends the same part at the same offset', async () => {
    const data = bytes(8 * MiB + 9)
    standIn.once('files/upload_session/append_v2', unauthorised)
    await storage().write(PATH, data, 'application/octet-stream')
    expect(await storage().read(PATH)).toEqual(data)
  })
})

describe('what is sent [P9-3, security]', () => {
  it.each([
    ['a control character', 'Root\u0007'],
    ['a DEL character', 'Ro\u007fot'],
    ['..', 'Root/../..'],
    ['a leading /', '/Root'],
    ['a trailing /', 'Root/'],
    ['a reserved name', 'Root/CON'],
    ['a backslash', 'Root\\x'],
    ['over 200 characters', 'r'.repeat(201)],
  ])('refuses a rootPath with %s before any request', async (_name, rootPath) => {
    for (const call of [
      (s: StorageProvider) => s.exists('a.txt'),
      (s: StorageProvider) => s.list(''),
      (s: StorageProvider) => s.write('a.txt', bytes(1), 'text/plain'),
    ])
      await expect(call(storage(rootPath))).rejects.toThrow(/^Storage path refused$/)
    expect(standIn.seen).toEqual([])
  })

  it('uses only fixed endpoints, no query string and no user or root override header', async () => {
    const s = storage()
    await s.write('x/y.txt', bytes(3), 'text/plain')
    await s.write('x/z.txt', streamOf(bytes(3), 1), 'text/plain')
    await s.exists('x/y.txt')
    await s.read('x/y.txt')
    await s.list('x')
    await s.remove(['x/y.txt'])
    for (const seen of standIn.seen) {
      expect(seen.headers).not.toHaveProperty('dropbox-api-select-user')
      expect(seen.headers).not.toHaveProperty('dropbox-api-select-admin')
      expect(seen.headers).not.toHaveProperty('dropbox-api-path-root')
      expect(seen.path).not.toContain('?')
    }
  })
})
