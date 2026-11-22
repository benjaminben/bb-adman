// P9-1 (spec/phases/phase-09.md "Dropbox tokens", A-211): canStore() tells the sign-in whether
// a token could be saved, and a sign-in secret's summary shows none of its characters.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createSecretStore, type SecretCrypto } from '@/main/secrets/secret-store'

function fakeCrypto(available = true): SecretCrypto {
  return {
    isAvailable: () => available,
    encrypt: (text) => Buffer.from(Buffer.from(text).toString('base64')),
    decrypt: (data) => Buffer.from(data.toString(), 'base64').toString(),
  }
}

let dir: string
let file: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-secrets-sign-in-'))
  file = path.join(dir, 'secrets.bin')
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('the secret store and sign-in secrets [P9-1, A-211]', () => {
  it.each([
    [true, true],
    [false, false],
  ])('canStore() is %s when secure storage is %s', (available, expected) => {
    const store = createSecretStore({ file, crypto: fakeCrypto(available) })
    expect(store.canStore()).toBe(expected)
  })

  it('lists the Dropbox refresh token with no characters, and a user key by its last four', () => {
    const store = createSecretStore({ file, crypto: fakeCrypto() })
    store.set('dropbox.refreshToken', 'made-up-refresh-token-wxyz')
    store.set('gemini.apiKey', 'made-up-gemini-key-1234')
    expect(store.summaries()).toEqual([
      { name: 'gemini.apiKey', lastFour: '1234' },
      { name: 'dropbox.refreshToken', lastFour: '' },
    ])
    expect(JSON.stringify(store.summaries())).not.toContain('wxyz')
  })
})

// P9-5b: sign-out must tell "no token saved" from "the saved keys cannot be read".
describe('readable() [P9-5b]', () => {
  it('is true with no file and with a file that reads, false with one that does not', () => {
    const store = createSecretStore({ file, crypto: fakeCrypto() })
    expect(store.readable()).toBe(true)
    store.set('dropbox.refreshToken', 'made-up-refresh-token-wxyz')
    expect(store.readable()).toBe(true)
    fs.writeFileSync(file, 'not base64 json {')
    expect(store.readable()).toBe(false)
    fs.writeFileSync(file, Buffer.from('[1, 2]').toString('base64'))
    expect(store.readable()).toBe(false)
  })
})
