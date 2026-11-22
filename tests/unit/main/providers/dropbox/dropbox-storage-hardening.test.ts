// P9-3b hardening of the Dropbox storage: the list cut with characters whose lower-case form has
// another length, the resend after a 401 when the user signed out meanwhile, and control
// characters in caller paths. Every call goes to the stand-in on 127.0.0.1.
import { describe, expect, it } from 'vitest'
import { failureOf } from '../../../../helpers/failure-of'
import { standInFetch } from '../../../../helpers/dropbox-stand-in'
import { dropboxStorage } from '@/main/providers/dropbox/dropbox-storage'
import type { AdapterContext } from '@/main/providers/types'
import { defaultSettings } from '@/main/settings/defaults'
import { refresh, routes, standIn, storage, setUpDropboxStorage } from './storage-harness'

setUpDropboxStorage()

const file = (display: string, lower = display.toLowerCase()) => ({
  '.tag': 'file',
  path_lower: lower,
  path_display: display,
})

function answerList(entries: object[]): void {
  standIn.once('files/list_folder', {
    status: 200,
    json: { entries, cursor: 'c', has_more: false },
  })
}

describe('Dropbox list cut [P9-3b, list.ts]', () => {
  // 'İ' (capital dotted I) lower-cases to two characters: 'i' and a combining dot.
  const dotted = 'i̇'

  it('cuts the root by its lower-case length, so a dotted I in the root cannot shift the cut', async () => {
    answerList([file(`/${dotted}${dotted}x/a.txt`)])
    expect(await storage('İİx').list('')).toEqual(['a.txt'])
  })

  it('drops a file whose shown path only matches the root after a length-changing lower-case', async () => {
    answerList([file('/İİx/x/a.txt', `/${dotted}${dotted}x/x/a.txt`)])
    expect(await storage(`${dotted}${dotted}x`).list('')).toEqual([])
  })
})

describe('control characters in caller paths [P9-3b, the root rule]', () => {
  it.each([
    ['a code 1 character', 'a\u0001b'],
    ['a DEL character', 'a\u007fb'],
    ['a C1 next-line character', 'a\u0085b'],
    ['a C1 control sequence introducer', 'a\u009bb'],
  ])('refuses a path with %s before any request', async (_name, bad) => {
    const s = storage()
    const calls = [
      () => s.exists(`in/${bad}.txt`),
      () => s.read(`in/${bad}.txt`),
      () => s.write(`in/${bad}.txt`, new Uint8Array([1]), 'text/plain'),
      () => s.remove(['in/ok.txt', `in/${bad}.txt`]),
      () => s.list(`in/${bad}`),
    ]
    for (const call of calls) await expect(call()).rejects.toThrow(/^Storage path refused$/)
    expect(standIn.seen).toEqual([])
  })
})

describe('the resend after a 401 when the user signed out meanwhile [P9-3b, send()]', () => {
  const unauthorised = { status: 401, json: { error: { '.tag': 'invalid_access_token' } } }

  // A context whose refresh token is `refresh` for the first read, then `after()`.
  function signedOutAfterFirst(after: () => string): AdapterContext {
    const settings = defaultSettings('/documents')
    settings.storage.dropbox = { accountName: 'Ann Example', rootPath: 'Root' }
    let reads = 0
    const secret = () => (reads++ === 0 ? refresh : after())
    return { secret, settings: () => settings, model: () => '' }
  }

  it.each<[string, () => string]>([
    [
      'the token is gone',
      () => {
        throw new Error('Secret not saved: dropbox.refreshToken')
      },
    ],
    ['the token was replaced', () => 'a-new-refresh-token'],
  ])('%s: dropbox_signed_out, with no renewal and no resend', async (_name, after) => {
    standIn.once('files/get_metadata', unauthorised)
    const ctx = signedOutAfterFirst(after)
    const store = dropboxStorage(ctx, { fetch: standInFetch(standIn), timeoutMs: 200 })
    const error = await store.exists('a.txt').catch((e: unknown) => e)
    expect(await failureOf(Promise.reject(error))).toEqual({
      kind: 'bad_key',
      reason: 'dropbox_signed_out',
      detail: 'signed out',
    })
    expect(routes()).toEqual(['token', 'files/get_metadata'])
    const text = `${String(error)} ${(error as Error).stack} ${JSON.stringify(error)}`
    for (const secret of [
      refresh,
      'a-new-refresh-token',
      'a.txt',
      ...standIn.accessTokensOf(refresh),
    ])
      expect(text).not.toContain(secret)
  })
})
